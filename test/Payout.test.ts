import { ethers, hardhatArguments, network } from "hardhat";
import { expect } from "chai";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import {
  takeSnapshot,
  SnapshotRestorer,
  time,
} from "@nomicfoundation/hardhat-network-helpers";
import {
  Ciphex,
  Ciphex__factory,
  MockUSD,
  MockUSD__factory,
  CiphexPayout,
  CiphexPayout__factory,
  ProxyMock__factory,
} from "../typechain-types";
import {
  ContractTransactionReceipt,
  ContractTransactionResponse,
  TransactionReceipt,
} from "ethers";
let owner: SignerWithAddress;
let user1: SignerWithAddress;
let user2: SignerWithAddress;
let CiphexFactory: Ciphex__factory;
let cpx: Ciphex;
let MockUSDFactory: MockUSD__factory;
let usdt: MockUSD;
let PayoutFactory: CiphexPayout__factory;
let payout: CiphexPayout;
let ProxyMockFactory: ProxyMock__factory;
let startSnapshot: SnapshotRestorer;
describe("Payout", async () => {
  before(async () => {
    [owner, user1, user2] = await ethers.getSigners();
    CiphexFactory = (await ethers.getContractFactory(
      "Ciphex"
    )) as Ciphex__factory;
    MockUSDFactory = (await ethers.getContractFactory(
      "MockUSD"
    )) as MockUSD__factory;
    PayoutFactory = (await ethers.getContractFactory(
      "CiphexPayout"
    )) as CiphexPayout__factory;
    ProxyMockFactory = (await ethers.getContractFactory(
      "ProxyMock"
    )) as ProxyMock__factory;

    usdt = await MockUSDFactory.deploy("TestToken", "TT");
    const ciphexImplementation = await CiphexFactory.deploy();
    const treasuryImplementation = await PayoutFactory.deploy();
    const proxy1 = await ProxyMockFactory.deploy(
      await ciphexImplementation.getAddress(),
      "0x"
    );
    const proxy2 = await ProxyMockFactory.deploy(
      await treasuryImplementation.getAddress(),
      "0x"
    );
    cpx = (await CiphexFactory.attach(await proxy1.getAddress())) as Ciphex;
    payout = (await PayoutFactory.attach(
      await proxy2.getAddress()
    )) as CiphexPayout;
    await cpx.initialize(owner.address, owner.address);
    await payout.initialize(await cpx.getAddress(), await usdt.getAddress());
    startSnapshot = await takeSnapshot();
  });
  describe("depositReward", async () => {
    let affiliate: string;
    let cpxAmount: bigint;
    let usdAmount: bigint;
    before(async () => {
      affiliate = user1.address;
      cpxAmount = ethers.parseEther("1000");
      usdAmount = ethers.parseUnits("100", 6);
      await cpx.approve(await payout.getAddress(), cpxAmount);
      await usdt.approve(await payout.getAddress(), usdAmount);
    });
    after(async () => {
      await startSnapshot.restore();
    });
    it("Must revert if sender isn't owner", async () => {
      await expect(
        payout.connect(user1).depositReward(affiliate, cpxAmount, usdAmount)
      ).to.be.revertedWithCustomError(payout, "OwnableUnauthorizedAccount");
    });
    it("Must revert if amount equals 0", async () => {
      await expect(
        payout.depositReward(affiliate, 0, usdAmount)
      ).to.be.revertedWithCustomError(payout, "ZeroValue");
      await expect(
        payout.depositReward(affiliate, cpxAmount, 0)
      ).to.be.revertedWithCustomError(payout, "ZeroValue");
    });
    it("Must revert if recipient is zero address", async () => {
      await expect(
        payout.depositReward(ethers.ZeroAddress, cpxAmount, usdAmount)
      ).to.be.revertedWithCustomError(payout, "ZeroAddress");
    });
    it("Must distribute rewards correctly", async () => {
      const tx: ContractTransactionResponse = await payout.depositReward(
        affiliate,
        cpxAmount,
        usdAmount
      );
      expect(tx)
        .to.emit(payout, "RewardsDeposited")
        .withArgs(affiliate, cpxAmount, usdAmount);
      expect(await usdt.balanceOf(affiliate)).to.be.equal(usdAmount);
      expect(await cpx.balanceOf(affiliate)).to.be.equal(cpxAmount);
    });
  });
  describe("depositRewards", async () => {
    let affiliate1: string;
    let affiliate2: string;
    let cpxAmount1: bigint;
    let usdAmount1: bigint;
    let cpxAmount2: bigint;
    let usdAmount2: bigint;
    before(async () => {
      affiliate1 = user1.address;
      cpxAmount1 = ethers.parseEther("1000");
      usdAmount1 = ethers.parseUnits("100", 6);
      affiliate2 = user2.address;
      cpxAmount2 = ethers.parseEther("2000");
      usdAmount2 = ethers.parseUnits("200", 6);
      await cpx.approve(await payout.getAddress(), cpxAmount1 + cpxAmount2);
      await usdt.approve(await payout.getAddress(), usdAmount1 + usdAmount2);
    });
    after(async () => {
      await startSnapshot.restore();
    });
    it("Must revert if sender isn't owner", async () => {
      await expect(
        payout
          .connect(user1)
          .depositRewards(
            [affiliate1, affiliate2],
            [cpxAmount1, cpxAmount2],
            [usdAmount1, usdAmount2]
          )
      ).to.be.revertedWithCustomError(payout, "OwnableUnauthorizedAccount");
    });
    it("Must revert if arrays lengths are different", async () => {
      await expect(
        payout.depositRewards(
          [affiliate1, affiliate2],
          [cpxAmount1],
          [usdAmount1, usdAmount2]
        )
      ).to.be.revertedWithCustomError(payout, "LenghMistmatch");
    });
    it("Must distribute multiple rewards correctly", async () => {
      const tx = await payout.depositRewards(
        [affiliate1, affiliate2],
        [cpxAmount1, cpxAmount2],
        [usdAmount1, usdAmount2]
      );
      expect(tx)
        .to.emit(payout, "RewardsDeposited")
        .withArgs(affiliate1, cpxAmount1, usdAmount1);
      expect(tx)
        .to.emit(payout, "RewardsDeposited")
        .withArgs(affiliate2, cpxAmount2, usdAmount2);
      expect(await usdt.balanceOf(affiliate1)).to.be.equal(usdAmount1);
      expect(await cpx.balanceOf(affiliate1)).to.be.equal(cpxAmount1);
      expect(await usdt.balanceOf(affiliate2)).to.be.equal(usdAmount2);
      expect(await cpx.balanceOf(affiliate2)).to.be.equal(cpxAmount2);
    });
  });
});
