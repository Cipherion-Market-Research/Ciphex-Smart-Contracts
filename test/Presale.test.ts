import { ethers, hardhatArguments, network } from "hardhat";
import { expect } from "chai";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import {
  takeSnapshot,
  SnapshotRestorer,
  time,
} from "@nomicfoundation/hardhat-network-helpers";
import {
  CiphexPresale,
  CiphexPresale__factory,
  Ciphex,
  Ciphex__factory,
  StakingMock,
  StakingMock__factory,
  ProxyMock,
  ProxyMock__factory,
  MockAggregatorV3,
  MockAggregatorV3__factory,
} from "../typechain-types";
import {
  AddressLike,
  ContractTransactionReceipt,
  ContractTransactionResponse,
  parseEther,
  TransactionReceipt,
} from "ethers";
import { presaleData } from "./helpers/testMockData";
import exp from "constants";
import { snapshot } from "node:test";
import { bigint } from "hardhat/internal/core/params/argumentTypes";
const USDC_HOLDER = "0x7713974908Be4BEd47172370115e8b1219F4A5f0";
const USDT_HOLDER = "0x8558FE88F8439dDcd7453ccAd6671Dfd90657a32";
const USDC_ETH = "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48";
const USDT_ETH = "0xdac17f958d2ee523a2206206994597c13d831ec7";
let owner: SignerWithAddress;
let user1: SignerWithAddress;
let user2: SignerWithAddress;
let usdcHolder: SignerWithAddress;
let usdtHolder: SignerWithAddress;
let startSnapshot: SnapshotRestorer;
let ciphex: Ciphex;
let usdc: Ciphex;
let usdt: Ciphex;
let CiphexFactory: Ciphex__factory;
let presale: CiphexPresale;
let PresaleFactory: CiphexPresale__factory;
let staking: StakingMock;
let StakingFactory: StakingMock__factory;
let ProxyFactory: ProxyMock__factory;
let chainlinkAggregator: MockAggregatorV3;
let AggregatorFactory: MockAggregatorV3__factory;
let defaultChainlinkDecimals = 8;
describe("Presale", async () => {
  before(async () => {
    await network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [USDC_HOLDER],
    });
    await network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [USDT_HOLDER],
    });
    [owner, user1, user2] = await ethers.getSigners();
    usdcHolder = await ethers.getSigner(USDC_HOLDER);
    usdtHolder = await ethers.getSigner(USDT_HOLDER);
    CiphexFactory = (await ethers.getContractFactory(
      "Ciphex"
    )) as Ciphex__factory;
    PresaleFactory = (await ethers.getContractFactory(
      "CiphexPresale"
    )) as CiphexPresale__factory;
    StakingFactory = (await ethers.getContractFactory(
      "StakingMock"
    )) as StakingMock__factory;
    ProxyFactory = (await ethers.getContractFactory(
      "ProxyMock"
    )) as ProxyMock__factory;
    AggregatorFactory = (await ethers.getContractFactory(
      "MockAggregatorV3"
    )) as MockAggregatorV3__factory;
    chainlinkAggregator = await AggregatorFactory.deploy();
    await chainlinkAggregator.setDecimals(defaultChainlinkDecimals);
    await chainlinkAggregator.setRoundData(
      1,
      ethers.parseUnits("2618.9111", defaultChainlinkDecimals),
      await time.latest(),
      await time.latest(),
      1
    );
    staking = await StakingFactory.deploy();
    ciphex = await CiphexFactory.deploy();
    const ciphexProxy = await ProxyFactory.deploy(
      await ciphex.getAddress(),
      "0x"
    );
    ciphex = (await CiphexFactory.attach(
      await ciphexProxy.getAddress()
    )) as Ciphex;
    usdc = (await CiphexFactory.attach(USDC_ETH)) as Ciphex;
    usdt = (await CiphexFactory.attach(USDT_ETH)) as Ciphex;
    await ciphex.initialize(owner.address, owner.address);
    presale = await PresaleFactory.deploy();
    const presaleProxy = await ProxyFactory.deploy(
      await presale.getAddress(),
      "0x"
    );
    presale = (await PresaleFactory.attach(
      await presaleProxy.getAddress()
    )) as CiphexPresale;
    await presale.initialize(
      USDC_ETH,
      USDT_ETH,
      chainlinkAggregator.getAddress()
    );
    await staking.setCiphex(await ciphex.getAddress());
    startSnapshot = await takeSnapshot();
  });
  describe("startPresale", async () => {
    after(async () => {
      await startSnapshot.restore();
    });
    it("Must revert if sender isn't owner", async () => {
      await expect(
        presale
          .connect(user1)
          .startPresale(
            await ciphex.getAddress(),
            await staking.getAddress(),
            ethers.parseEther("1"),
            time.duration.weeks(4)
          )
      ).to.be.revertedWithCustomError(presale, "OwnableUnauthorizedAccount");
    });
    it("Must revert if one of addresses is zero address", async () => {
      await expect(
        presale.startPresale(
          ethers.ZeroAddress,
          await staking.getAddress(),
          ethers.parseEther("1"),
          time.duration.weeks(4)
        )
      ).to.be.revertedWithCustomError(presale, "ZeroAddress");
      await expect(
        presale.startPresale(
          await ciphex.getAddress(),
          ethers.ZeroAddress,
          ethers.parseEther("1"),
          time.duration.weeks(4)
        )
      ).to.be.revertedWithCustomError(presale, "ZeroAddress");
    });
    it("Must revert if one of values is 0", async () => {
      await expect(
        presale.startPresale(
          await ciphex.getAddress(),
          await staking.getAddress(),
          0,
          time.duration.weeks(4)
        )
      ).to.be.revertedWithCustomError(presale, "ZeroValue");
      await expect(
        presale.startPresale(
          await ciphex.getAddress(),
          await staking.getAddress(),
          ethers.parseEther("1"),
          0
        )
      ).to.be.revertedWithCustomError(presale, "ZeroValue");
    });
    it("Must revert if owner hasn't aproved ciphex token", async () => {
      await expect(
        presale.startPresale(
          await ciphex.getAddress(),
          await staking.getAddress(),
          ethers.parseEther("1"),
          time.duration.weeks(4)
        )
      ).to.be.revertedWithCustomError(ciphex, "ERC20InsufficientAllowance");
    });
    it("Must start presale correctly", async () => {
      await ciphex.approve(await presale.getAddress(), ethers.parseEther("1"));
      const curTime = await time.latest();
      expect(
        await presale.startPresale(
          await ciphex.getAddress(),
          await staking.getAddress(),
          ethers.parseEther("1"),
          time.duration.weeks(4)
        )
      ).to.be.emit(presale, "PresaleStarted");
      expect(await presale.presaleStart()).to.be.closeTo(curTime, 2);
      expect(await presale.presaleEnd()).to.be.closeTo(
        curTime + time.duration.weeks(4),
        2
      );
      expect(await presale.ciphex()).to.be.equal(await ciphex.getAddress());
      expect(await presale.staking()).to.be.equal(await staking.getAddress());
      expect(await presale.ciphexSupply()).to.be.equal(ethers.parseEther("1"));
      expect(await presale.getTokenPrice()).to.be.equal(
        ethers.parseUnits("0.1", 6)
      );
    });
    it("Must revert if presale has already started", async () => {
      await expect(
        presale.startPresale(
          await ciphex.getAddress(),
          await staking.getAddress(),
          ethers.parseEther("1"),
          time.duration.weeks(4)
        )
      ).to.be.revertedWithCustomError(presale, "PresaleAlreadyStarted");
    });
  });
  describe("buy", async () => {
    describe("with not active presale", async () => {
      it("Must revert if presale hasn't started yet", async () => {
        await expect(
          presale.buy(
            ethers.ZeroAddress,
            ethers.parseEther("0.1"),
            user1.address,
            user2.address
          )
        ).to.be.revertedWithCustomError(presale, "NotActivePresale");
      });
      it("Function getTokenPrice must returns 0", async () => {
        expect(await presale.getTokenPrice()).to.be.equal(0);
      });
    });
    describe("with active presale", async () => {
      let ethPrice: bigint;
      let caseNum: number;
      let ciphexPresaleSupply: bigint;
      let initUsdcBalance: bigint;
      let initUsdtBalance: bigint;
      let possibleEthDeviation: number;
      let possibleTokenDeviation: number;
      let possiblePriceDeviation: number;
      let additionalEth: bigint;
      before(async () => {
        caseNum = 0;
        ethPrice = await presale.getEthPrice();
        ciphexPresaleSupply = ethers.parseEther("1000000");
        possibleEthDeviation = 100000000000;
        possibleTokenDeviation = 1000000000000000;
        possiblePriceDeviation = 300;
        additionalEth = ethers.parseEther("0.0000001");
        initUsdcBalance = await usdc.balanceOf(usdcHolder.address);
        initUsdtBalance = await usdt.balanceOf(usdtHolder.address);
      });
      beforeEach(async () => {
        await ciphex.approve(await presale.getAddress(), ciphexPresaleSupply);
        await presale.startPresale(
          await ciphex.getAddress(),
          await staking.getAddress(),
          ciphexPresaleSupply,
          time.duration.days(181)
        );
      });
      afterEach(async () => {
        await startSnapshot.restore();
      });
      describe("view functions", async () => {
        it("Must returns 0 if passed zero", async () => {
          expect(await presale.convertEthToTokens(0)).to.be.equal(0);
          expect(await presale.convertTokensToEth(0)).to.be.equal(0);
          expect(await presale.convertUsdToTokens(0)).to.be.equal(0);
          expect(await presale.convertTokensToUsd(0)).to.be.equal(0);
        });
        it("getTokenPrice must return correct price", async () => {
          for (let i: any = 0; i < 182; i++) {
            if (presaleData.priceCases[caseNum].days[i + 1]) {
              expect(await presale.getTokenPrice()).to.be.closeTo(
                presaleData.priceCases[caseNum].days[i + 1].price,
                possiblePriceDeviation
              );
            }
            await time.increase(time.duration.days(1));
          }
        });
        it("convertTokensToEth must convert correctly", async () => {
          for (let i: any = 0; i < 182; i++) {
            if (presaleData.priceCases[caseNum].days[i + 1]) {
              expect(
                await presale.convertTokensToEth(await ethers.parseEther("1"))
              ).to.be.closeTo(
                presaleData.priceCases[caseNum].days[i + 1].ethPerOne,
                possibleEthDeviation
              );
            }
            await time.increase(time.duration.days(1));
            await chainlinkAggregator.setRoundData(
              1,
              ethers.parseUnits("2618.9111", defaultChainlinkDecimals),
              await time.latest(),
              await time.latest(),
              1
            );
          }
        });
        it("convertEthToTokens must convert correctly", async () => {
          for (let i: any = 0; i < 182; i++) {
            if (presaleData.priceCases[caseNum].days[i + 1]) {
              expect(
                await presale.convertEthToTokens(
                  presaleData.priceCases[caseNum].days[i + 1].ethPerOne
                )
              ).to.be.closeTo(ethers.parseEther("1"), possibleTokenDeviation);
            }
            await time.increase(time.duration.days(1));
            await chainlinkAggregator.setRoundData(
              1,
              ethers.parseUnits("2618.9111", defaultChainlinkDecimals),
              await time.latest(),
              await time.latest(),
              1
            );
          }
        });
        it("convertUsdToTokens must convert correctly", async () => {
          for (let i: any = 0; i < 182; i++) {
            if (presaleData.priceCases[caseNum].days[i + 1]) {
              expect(
                await presale.convertUsdToTokens(
                  presaleData.priceCases[caseNum].days[i + 1].price
                )
              ).to.be.closeTo(ethers.parseEther("1"), possibleTokenDeviation);
            }
            await time.increase(time.duration.days(1));
          }
        });
        it("convertTokensToUsd must convert correctly", async () => {
          for (let i: any = 0; i < 182; i++) {
            if (presaleData.priceCases[caseNum].days[i + 1]) {
              expect(
                await presale.convertTokensToUsd(await ethers.parseEther("1"))
              ).to.be.closeTo(
                presaleData.priceCases[caseNum].days[i + 1].price,
                possiblePriceDeviation
              );
            }
            await time.increase(time.duration.days(1));
          }
        });
      });
      describe("write function buy", async () => {
        it("Must revert if recipient is zero address", async () => {
          await expect(
            presale.buy(
              ethers.ZeroAddress,
              ethers.parseEther("0.1"),
              ethers.ZeroAddress,
              ethers.ZeroAddress
            )
          ).to.be.revertedWithCustomError(presale, "ZeroAddress");
        });
        it("Must revert if amount equals 0", async () => {
          await expect(
            presale.buy(
              ethers.ZeroAddress,
              ethers.parseEther("0"),
              owner.address,
              ethers.ZeroAddress
            )
          ).to.be.revertedWithCustomError(presale, "ZeroValue");
        });
        it("Must revert if referral and recipient are same", async () => {
          await expect(
            presale.buy(
              ethers.ZeroAddress,
              ethers.parseEther("0.1"),
              owner.address,
              owner.address
            )
          ).to.be.revertedWithCustomError(presale, "InvalidReferral");
        });
        it("Must revert if token isn't ETH/USDC/USDT", async () => {
          await expect(
            presale.buy(
              owner.address,
              ethers.parseEther("0.1"),
              owner.address,
              ethers.ZeroAddress
            )
          ).to.be.revertedWithCustomError(presale, "InvalidTokenAddress");
        });
        it("Must revert if USDC or USDT have negative status", async () => {
          await presale.setStableStatus(USDC_ETH, false);
          await presale.setStableStatus(USDT_ETH, false);
          await expect(
            presale.buy(
              USDC_ETH,
              ethers.parseEther("0.1"),
              owner.address,
              ethers.ZeroAddress
            )
          ).to.be.revertedWithCustomError(presale, "InvalidTokenAddress");
          await expect(
            presale.buy(
              USDT_ETH,
              ethers.parseEther("0.1"),
              owner.address,
              ethers.ZeroAddress
            )
          ).to.be.revertedWithCustomError(presale, "InvalidTokenAddress");
        });
        it("Must revert if bought amount of ciphex tokens is less than minimum amount to buy", async () => {
          await expect(
            presale.buy(
              ethers.ZeroAddress,
              presaleData.priceCases[caseNum].days[1].ethPerOne,
              owner.address,
              ethers.ZeroAddress,
              { value: presaleData.priceCases[caseNum].days[1].ethPerOne }
            )
          ).to.be.revertedWithCustomError(presale, "NotEnoughCiphex");
        });
        it("Must revert if ciphex tokens supply is less than min amount to buy", async () => {
          const ethToSpend =
            (await presale.convertTokensToEth(ciphexPresaleSupply)) -
            additionalEth;
          await expect(
            presale.buy(
              ethers.ZeroAddress,
              ethToSpend,
              owner.address,
              ethers.ZeroAddress,
              { value: ethToSpend }
            )
          ).to.be.revertedWithCustomError(presale, "NotEnoughCiphex");
        });
        it("Must buy all ciphex token in one transaction for eth", async () => {
          const expEth = await presale.convertTokensToEth(ciphexPresaleSupply);
          const ethToSpend = expEth + 1000n;
          expect(await presale.isPresaleActive()).to.be.true;
          const tx: ContractTransactionResponse = await presale
            .connect(user1)
            .buy(
              ethers.ZeroAddress,
              ethToSpend,
              user1.address,
              ethers.ZeroAddress,
              { value: ethToSpend }
            );
          const txReceipt: ContractTransactionReceipt =
            (await tx.wait()) as ContractTransactionReceipt;
          expect(tx).to.be.emit(presale, "Bought");
          expect(await presale.ciphexSupply()).to.be.equal(0);
          expect(
            await ciphex.balanceOf(await staking.getAddress())
          ).to.be.equal(ciphexPresaleSupply);
          expect(
            await ciphex.balanceOf(await presale.getAddress())
          ).to.be.equal(0);
          const txFee = txReceipt.fee;
          expect(await ethers.provider.getBalance(user1)).to.be.closeTo(
            ethers.parseEther("10000") - expEth - txFee,
            1000n
          );
          expect(
            await ethers.provider.getBalance(await presale.getAddress())
          ).to.be.closeTo(expEth, 100);
        });
        it("Must buy all ciphex token in one transaction for usdc", async () => {
          const expUsdc = await presale.convertTokensToUsd(ciphexPresaleSupply);
          const usdcToSpend = expUsdc + 1000n; // additional usdc to exclude situation of small siphex remainder
          expect(await presale.isPresaleActive()).to.be.true;
          await usdc
            .connect(usdcHolder)
            .approve(await presale.getAddress(), usdcToSpend);
          const tx: ContractTransactionResponse = await presale
            .connect(usdcHolder)
            .buy(
              await usdc.getAddress(),
              usdcToSpend,
              usdcHolder.address,
              ethers.ZeroAddress
            );
          const txReceipt: ContractTransactionReceipt =
            (await tx.wait()) as ContractTransactionReceipt;
          expect(tx).to.be.emit(presale, "Bought");
          expect(await presale.ciphexSupply()).to.be.equal(0);
          expect(
            await ciphex.balanceOf(await staking.getAddress())
          ).to.be.equal(ciphexPresaleSupply);
          expect(
            await ciphex.balanceOf(await presale.getAddress())
          ).to.be.equal(0);
          const txFee = txReceipt.fee;
          expect(
            await usdc.balanceOf(await presale.getAddress())
          ).to.be.closeTo(expUsdc, 100);
        });
        it("Must buy all ciphex token in one transaction for usdt", async () => {
          const expUsdt = await presale.convertTokensToUsd(ciphexPresaleSupply);
          const usdtToSpend = expUsdt + 1000n;
          expect(await presale.isPresaleActive()).to.be.true;
          await usdt
            .connect(usdtHolder)
            .approve(await presale.getAddress(), usdtToSpend);
          const tx: ContractTransactionResponse = await presale
            .connect(usdtHolder)
            .buy(
              await usdt.getAddress(),
              usdtToSpend,
              usdtHolder.address,
              ethers.ZeroAddress
            );
          const txReceipt: ContractTransactionReceipt =
            (await tx.wait()) as ContractTransactionReceipt;
          expect(tx).to.be.emit(presale, "Bought");
          expect(await presale.ciphexSupply()).to.be.equal(0);
          expect(
            await ciphex.balanceOf(await staking.getAddress())
          ).to.be.equal(ciphexPresaleSupply);
          expect(
            await ciphex.balanceOf(await presale.getAddress())
          ).to.be.equal(0);
          const txFee = txReceipt.fee;
          expect(
            await usdt.balanceOf(await presale.getAddress())
          ).to.be.closeTo(expUsdt, 100);
        });
        it("Must revert if all ciphex tokens are sold", async () => {
          const expUsdt = await presale.convertTokensToUsd(ciphexPresaleSupply);
          const usdtToSpend = expUsdt + 1000n;
          await usdt
            .connect(usdtHolder)
            .approve(await presale.getAddress(), usdtToSpend);
          const tx: ContractTransactionResponse = await presale
            .connect(usdtHolder)
            .buy(
              await usdt.getAddress(),
              usdtToSpend,
              usdtHolder.address,
              ethers.ZeroAddress
            );
          expect(await presale.isPresaleActive()).to.be.false;
          await expect(
            presale.buy(
              await usdt.getAddress(),
              usdtToSpend,
              usdtHolder.address,
              ethers.ZeroAddress
            )
          ).to.be.revertedWithCustomError(presale, "NotActivePresale");
        });
        it("Must refund if eth value is greater than passed one", async () => {
          const expEth = await presale.convertTokensToEth(ciphexPresaleSupply);
          const ethToSpend = expEth + 1000n;
          expect(await presale.isPresaleActive()).to.be.true;
          const tx: ContractTransactionResponse = await presale
            .connect(user1)
            .buy(
              ethers.ZeroAddress,
              ethToSpend,
              user1.address,
              ethers.ZeroAddress,
              { value: ethToSpend * 2n }
            );
          const txReceipt: ContractTransactionReceipt =
            (await tx.wait()) as ContractTransactionReceipt;
          expect(tx).to.be.emit(presale, "Bought");
          expect(await presale.ciphexSupply()).to.be.equal(0);
          expect(
            await ciphex.balanceOf(await staking.getAddress())
          ).to.be.equal(ciphexPresaleSupply);
          expect(
            await ciphex.balanceOf(await presale.getAddress())
          ).to.be.equal(0);
          const txFee = txReceipt.fee;
          expect(await ethers.provider.getBalance(user1)).to.be.closeTo(
            ethers.parseEther("10000") - expEth - txFee,
            1000n
          );
          expect(
            await ethers.provider.getBalance(await presale.getAddress())
          ).to.be.closeTo(expEth, 100);
        });
        it("Must refund if remainder of tokens is less then expected for eth", async () => {
          const halfSupply = ciphexPresaleSupply / 2n;
          const ethToSpend1 =
            (await presale.convertTokensToEth(halfSupply)) + 1000n;
          const ethToSpend2 = await presale.convertTokensToEth(
            ciphexPresaleSupply
          );
          const tx1: ContractTransactionResponse = await presale
            .connect(user1)
            .buy(
              ethers.ZeroAddress,
              ethToSpend1,
              user1.address,
              ethers.ZeroAddress,
              { value: ethToSpend1 }
            );
          const txReceipt1: ContractTransactionReceipt =
            (await tx1.wait()) as ContractTransactionReceipt;
          const tx2: ContractTransactionResponse = await presale
            .connect(user1)
            .buy(
              ethers.ZeroAddress,
              ethToSpend2,
              user1.address,
              ethers.ZeroAddress,
              { value: ethToSpend2 }
            );
          const txReceipt2: ContractTransactionReceipt =
            (await tx2.wait()) as ContractTransactionReceipt;
          expect(await presale.ciphexSupply()).to.be.equal(0);
          expect(
            await ciphex.balanceOf(await staking.getAddress())
          ).to.be.equal(ciphexPresaleSupply);
          expect(
            await ciphex.balanceOf(await presale.getAddress())
          ).to.be.equal(0);
          const txFee1 = txReceipt1.fee;
          const txFee2 = txReceipt2.fee;
          expect(await ethers.provider.getBalance(user1)).to.be.closeTo(
            ethers.parseEther("10000") - ethToSpend2 - txFee1 - txFee2,
            1000n
          );
          expect(
            await ethers.provider.getBalance(await presale.getAddress())
          ).to.be.closeTo(ethToSpend2, 1000n);
        });
        it("Must refund if remainder of tokens is less then expected for usdc", async () => {
          const halfSupply = ciphexPresaleSupply / 2n;
          const usdToSpend1 =
            (await presale.convertTokensToUsd(halfSupply)) + 100n;
          const usdToSpend2 = await presale.convertTokensToUsd(
            ciphexPresaleSupply
          );
          await usdc
            .connect(usdcHolder)
            .approve(await presale.getAddress(), usdToSpend1 + usdToSpend2);
          const tx1: ContractTransactionResponse = await presale
            .connect(usdcHolder)
            .buy(USDC_ETH, usdToSpend1, usdcHolder.address, ethers.ZeroAddress);
          const tx2: ContractTransactionResponse = await presale
            .connect(usdcHolder)
            .buy(USDC_ETH, usdToSpend2, usdcHolder.address, ethers.ZeroAddress);
          expect(await presale.ciphexSupply()).to.be.equal(0);
          expect(
            await ciphex.balanceOf(await staking.getAddress())
          ).to.be.equal(ciphexPresaleSupply);
          expect(
            await ciphex.balanceOf(await presale.getAddress())
          ).to.be.equal(0);
          expect(
            await usdc.balanceOf(await presale.getAddress())
          ).to.be.closeTo(usdToSpend2, 1000n);
          expect(await usdc.balanceOf(usdcHolder.address)).to.be.closeTo(
            initUsdcBalance - usdToSpend2,
            1000n
          );
        });
        it("Must refund if remainder of tokens is less then expected for usdt", async () => {
          const halfSupply = ciphexPresaleSupply / 2n;
          const usdToSpend1 =
            (await presale.convertTokensToUsd(halfSupply)) + 100n;
          const usdToSpend2 = await presale.convertTokensToUsd(
            ciphexPresaleSupply
          );
          await usdt
            .connect(usdtHolder)
            .approve(await presale.getAddress(), usdToSpend1 + usdToSpend2);
          await presale
            .connect(usdtHolder)
            .buy(USDT_ETH, usdToSpend1, usdtHolder.address, ethers.ZeroAddress);
          await presale
            .connect(usdtHolder)
            .buy(USDT_ETH, usdToSpend2, usdtHolder.address, ethers.ZeroAddress);
          expect(await presale.ciphexSupply()).to.be.equal(0);
          expect(
            await ciphex.balanceOf(await staking.getAddress())
          ).to.be.equal(ciphexPresaleSupply);
          expect(
            await ciphex.balanceOf(await presale.getAddress())
          ).to.be.equal(0);
          expect(
            await usdt.balanceOf(await presale.getAddress())
          ).to.be.closeTo(usdToSpend2, 1000n);
          expect(await usdt.balanceOf(usdtHolder.address)).to.be.closeTo(
            initUsdtBalance - usdToSpend2,
            1000n
          );
        });
        it("Must buy 2000 token for start price by ETH", async () => {
          await presale.buy(
            ethers.ZeroAddress,
            presaleData.priceCases[caseNum].days[1].ethInMin + additionalEth, // to exclude situations when token equal 0.99999999
            owner.address,
            ethers.ZeroAddress,
            {
              value:
                presaleData.priceCases[caseNum].days[1].ethInMin +
                additionalEth,
            }
          );
          expect(await presale.ciphexSupply()).to.be.closeTo(
            ciphexPresaleSupply - ethers.parseEther("2000"),
            ethers.parseEther("0.1")
          );
          expect(
            await ciphex.balanceOf(await staking.getAddress())
          ).to.be.closeTo(ethers.parseEther("2000"), ethers.parseEther("0.1"));
        });
        it("Must buy 2000 token for start price by USDC", async () => {
          let usdcToSpend =
            presaleData.priceCases[caseNum].days[1].price * 2000n;
          await usdc
            .connect(usdcHolder)
            .approve(await presale.getAddress(), usdcToSpend);
          await presale
            .connect(usdcHolder)
            .buy(USDC_ETH, usdcToSpend, owner.address, ethers.ZeroAddress);
          expect(await presale.ciphexSupply()).to.be.closeTo(
            ciphexPresaleSupply - ethers.parseEther("2000"),
            ethers.parseEther("0.000001")
          );
          expect(
            await ciphex.balanceOf(await staking.getAddress())
          ).to.be.closeTo(
            ethers.parseEther("2000"),
            ethers.parseEther("0.000001")
          );
        });
        it("Must buy 2000 token for start price by USDT", async () => {
          let usdtToSpend =
            presaleData.priceCases[caseNum].days[1].price * 2000n;
          await usdt
            .connect(usdtHolder)
            .approve(await presale.getAddress(), usdtToSpend);
          await presale
            .connect(usdtHolder)
            .buy(USDT_ETH, usdtToSpend, owner.address, ethers.ZeroAddress);
          expect(await presale.ciphexSupply()).to.be.closeTo(
            ciphexPresaleSupply - ethers.parseEther("2000"),
            ethers.parseEther("0.000001")
          );
          expect(
            await ciphex.balanceOf(await staking.getAddress())
          ).to.be.closeTo(
            ethers.parseEther("2000"),
            ethers.parseEther("0.000001")
          );
        });
        it("Must refund eth if you buy Ciphex token for usdc or usdt", async () => {
          const beforeEthBalace = await ethers.provider.getBalance(usdcHolder);
          const usdcToSpend =
            presaleData.priceCases[caseNum].days[1].price * 2000n;
          const approveFee: bigint = (
            (await (
              await usdc
                .connect(usdcHolder)
                .approve(await presale.getAddress(), usdcToSpend)
            ).wait()) as TransactionReceipt
          ).fee;
          let tx = await presale
            .connect(usdcHolder)
            .buy(USDC_ETH, usdcToSpend, owner.address, ethers.ZeroAddress, {
              value: ethers.parseEther("1"),
            });
          let txFee: bigint = ((await tx.wait()) as TransactionReceipt).fee;
          expect(await ethers.provider.getBalance(usdcHolder)).to.be.equal(
            beforeEthBalace - txFee - approveFee
          );
          expect(await presale.ciphexSupply()).to.be.closeTo(
            ciphexPresaleSupply - ethers.parseEther("2000"),
            ethers.parseEther("0.000001")
          );
          expect(
            await ciphex.balanceOf(await staking.getAddress())
          ).to.be.closeTo(
            ethers.parseEther("2000"),
            ethers.parseEther("0.000001")
          );
        });
      });
    });
  });
  describe("setStableStatus", async () => {
    afterEach(async () => {
      await startSnapshot.restore();
    });
    it("Must revert if sender isn't owner", async () => {
      await expect(
        presale.connect(user1).setStableStatus(USDC_ETH, false)
      ).to.be.revertedWithCustomError(presale, "OwnableUnauthorizedAccount");
    });
    it("Must revert if passed address isn't usdc or usdt address", async () => {
      await expect(
        presale.setStableStatus(user1, false)
      ).to.be.revertedWithCustomError(presale, "InvalidTokenAddress");
    });
    it("Must set up negative state correctly", async () => {
      expect(await presale.setStableStatus(USDC_ETH, false))
        .to.be.emit(presale, "StatusUpdated")
        .withArgs(USDC_ETH, false);
      expect(await presale.tokenStatus(USDC_ETH)).to.be.false;
      expect(await presale.tokenStatus(USDT_ETH)).to.be.true;
    });
  });
  describe("withdrawFunds", async () => {
    let ethBalance: bigint;
    let usdcBalance: bigint;
    let usdtBalance: bigint;
    let ciphexPresaleSupply: bigint;
    let presaleDuration: number;
    before(async () => {
      ethBalance = await ethers.parseEther("10");
      usdcBalance = await ethers.parseUnits("1000", 6);
      usdtBalance = await ethers.parseUnits("2000", 6);
      ciphexPresaleSupply = ethers.parseEther("1000000000");
      presaleDuration = time.duration.weeks(5);
    });
    beforeEach(async () => {
      await ciphex.approve(await presale.getAddress(), ciphexPresaleSupply);
      await presale.startPresale(
        await ciphex.getAddress(),
        await staking.getAddress(),
        ciphexPresaleSupply,
        presaleDuration
      );
      await presale.buy(
        ethers.ZeroAddress,
        ethBalance,
        owner.address,
        ethers.ZeroAddress,
        { value: ethBalance }
      );
      await usdc
        .connect(usdcHolder)
        .approve(await presale.getAddress(), usdcBalance);
      await presale
        .connect(usdcHolder)
        .buy(USDC_ETH, usdcBalance, owner.address, ethers.ZeroAddress);
      await usdt
        .connect(usdtHolder)
        .approve(await presale.getAddress(), usdtBalance);
      await presale
        .connect(usdtHolder)
        .buy(USDT_ETH, usdtBalance, owner.address, ethers.ZeroAddress);
    });
    afterEach(async () => {
      await startSnapshot.restore();
    });
    it("Must revert if arrays have different length", async () => {
      await expect(
        presale.withdrawFunds(
          [USDC_ETH, USDT_ETH],
          [owner.address],
          [ethers.parseUnits("10", 6)]
        )
      ).to.be.revertedWithCustomError(presale, "LenghMistmatch");
      await expect(
        presale.withdrawFunds(
          [USDC_ETH],
          [owner.address, user1.address],
          [ethers.parseUnits("10", 6)]
        )
      ).to.be.revertedWithCustomError(presale, "LenghMistmatch");
      await expect(
        presale.withdrawFunds(
          [USDC_ETH],
          [owner.address],
          [ethers.parseUnits("10", 6), ethers.parseUnits("10", 6)]
        )
      ).to.be.revertedWithCustomError(presale, "LenghMistmatch");
    });
    it("Must revert if requested amount of ciphex tokens exceeds available amount", async () => {
      await expect(
        presale.withdrawFunds(
          [await ciphex.getAddress()],
          [owner.address],
          [ethers.parseUnits("10", 6)]
        )
      ).to.be.revertedWithCustomError(presale, "NotEnoughCiphex");
    });
    it("Must transfer tokens correctly", async () => {
      const userBalance = await ethers.provider.getBalance(user1.address);
      const userUsdcBalance = await usdc.balanceOf(user1.address);

      const usdToTransfer = ethers.parseUnits("10", 6);
      const toTransfer = ethers.parseEther("10");
      await ciphex.transfer(
        await presale.getAddress(),
        ethers.parseEther("10")
      );
      await presale.withdrawFunds(
        [ethers.ZeroAddress, USDC_ETH, USDT_ETH, await ciphex.getAddress()],
        [user1.address, user1.address, user1.address, user1.address],
        [toTransfer, usdToTransfer, usdToTransfer, toTransfer]
      );
      expect(await ethers.provider.getBalance(user1.address)).to.be.equal(
        userBalance + toTransfer
      );
      expect(await ciphex.balanceOf(user1.address)).to.be.equal(toTransfer);
      expect(await usdt.balanceOf(user1.address)).to.be.equal(usdToTransfer);
      expect(await usdc.balanceOf(user1.address)).to.be.equal(
        userUsdcBalance + usdToTransfer
      );
    });
    it("Must allow to withdraw all Ciphex tokens after presale end", async () => {
      await time.increase(presaleDuration);
      const ciphexRemainder = await presale.ciphexSupply();
      await presale.withdrawFunds(
        [await ciphex.getAddress()],
        [user1.address],
        [ciphexRemainder]
      );
      expect(await ciphex.balanceOf(user1.address)).to.be.equal(
        ciphexRemainder
      );
      expect(await ciphex.balanceOf(await presale.getAddress())).to.be.equal(0);
    });
  });
  describe("comparing convertion of eth, usd, cpx between each other", async () => {
    let day: string;
    let priceCase: number;
    let ciphexPresaleSupply: bigint;
    before(async () => {
      priceCase = 0;
      day = "1";
      ciphexPresaleSupply = ethers.parseEther("10000");
      await ciphex.approve(await presale.getAddress(), ciphexPresaleSupply);
      await presale.startPresale(
        await ciphex.getAddress(),
        await staking.getAddress(),
        ciphexPresaleSupply,
        time.duration.days(180)
      );
    });

    after(async () => {
      await startSnapshot.restore();
    });
    /* it("Show convertions", async () => {
      let expCpx = ethers.parseEther("2000");
      for (let i: any = 0; i < 182; i++) {
        if (presaleData.priceCases[priceCase].days[i + 1]) {
          let cpxToEth = await presale.convertTokensToEth(expCpx);
          let ethToCpx = await presale.convertEthToTokens(cpxToEth + 1n);
          let cpxToUsd = await presale.convertTokensToUsd(expCpx);
          let usdToCpx = await presale.convertUsdToTokens(cpxToUsd);
          let ethDelta = expCpx - ethToCpx;
          let usdDelta = expCpx - usdToCpx;
          console.log(i + 1, "eth: exp - real", expCpx - ethToCpx);
          console.log(i + 1, "usd: exp - real", expCpx - usdToCpx);
        }
        await time.increase(time.duration.days(1));
        await chainlinkAggregator.setRoundData(
          1,
          ethers.parseUnits("2618.9111", defaultChainlinkDecimals),
          await time.latest(),
          await time.latest(),
          1
        );
      }
    }); */
  });
});
