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
  CiphexStaking,
  CiphexStaking__factory,
  ProxyMock,
  ProxyMock__factory,
} from "../typechain-types";
import {
  ContractTransactionReceipt,
  ContractTransactionResponse,
  TransactionReceipt,
} from "ethers";
import { stakeData, vestingData } from "./helpers/testMockData";
import exp from "node:constants";
let owner: SignerWithAddress;
let presale: SignerWithAddress;
let user1: SignerWithAddress;
let CiphexFactory: Ciphex__factory;
let ciphex: Ciphex;
let StakingFactory: CiphexStaking__factory;
let stakingImplementation: CiphexStaking;
let staking: CiphexStaking;
let ProxyFactory: ProxyMock__factory;
let startSnapshot: SnapshotRestorer;
let rewardIndex: bigint;
describe("Staking", async () => {
  before(async () => {
    [owner, presale, user1] = await ethers.getSigners();
    CiphexFactory = (await ethers.getContractFactory(
      "Ciphex"
    )) as Ciphex__factory;
    StakingFactory = (await ethers.getContractFactory(
      "CiphexStaking"
    )) as CiphexStaking__factory;
    ProxyFactory = (await ethers.getContractFactory(
      "ProxyMock"
    )) as ProxyMock__factory;
    stakingImplementation = await StakingFactory.deploy();
    ciphex = await CiphexFactory.deploy();
    const proxy1 = await ProxyFactory.deploy(await ciphex.getAddress(), "0x");
    const proxy2 = await ProxyFactory.deploy(
      await stakingImplementation.getAddress(),
      "0x"
    );
    ciphex = (await CiphexFactory.attach(await proxy1.getAddress())) as Ciphex;
    staking = (await StakingFactory.attach(
      await proxy2.getAddress()
    )) as CiphexStaking;
    await ciphex.initialize(owner.address, owner.address);
    rewardIndex = stakeData.days[1].rewardIndex;
    await staking.initialize(
      await ciphex.getAddress(),
      presale.address,
      rewardIndex
    );
    startSnapshot = await takeSnapshot();
  });
  describe("initialize", async () => {
    let localProxy: ProxyMock;
    let localStaking: CiphexStaking;
    before(async () => {
      localProxy = await ProxyFactory.deploy(
        await stakingImplementation.getAddress(),
        "0x"
      );
      localStaking = (await StakingFactory.attach(
        await localProxy.getAddress()
      )) as CiphexStaking;
    });
    after(async () => {
      await startSnapshot.restore();
    });
    it("Must revert if one of passed addresses equals to zero", async () => {
      await expect(
        localStaking.initialize(
          ethers.ZeroAddress,
          presale.address,
          rewardIndex
        )
      ).to.be.revertedWithCustomError(staking, "ZeroAddress");
      await expect(
        localStaking.initialize(
          await ciphex.getAddress(),
          ethers.ZeroAddress,
          rewardIndex
        )
      ).to.be.revertedWithCustomError(staking, "ZeroAddress");
    });
    it("Must revert if passed reward index isn't correct", async () => {
      await expect(
        localStaking.initialize(await ciphex.getAddress(), presale.address, 0)
      ).to.be.revertedWithCustomError(staking, "InvalidRewardIndex");
    });
  });
  describe("stake", async () => {
    afterEach(async () => {
      await startSnapshot.restore();
    });
    it("Must revert if sender isn't owner or presale sc", async () => {
      await expect(
        staking
          .connect(user1)
          ["stake(address,uint256)"](
            user1.address,
            ethers.parseEther("1000000")
          )
      ).to.be.revertedWithCustomError(staking, "AccessDenied");
    });
    it("Must revert if amount equals 0", async () => {
      await expect(
        staking["stake(address,uint256)"](user1.address, ethers.parseEther("0"))
      ).to.be.revertedWithCustomError(staking, "ZeroValue");
    });
    it("Must revert if recipient is zero address", async () => {
      await expect(
        staking["stake(address,uint256)"](
          ethers.ZeroAddress,
          ethers.parseEther("10")
        )
      ).to.be.revertedWithCustomError(staking, "ZeroAddress");
    });
    it("Must revert if sender hasn't approved enough ciphex tokens", async () => {
      await ciphex.approve(await staking.getAddress(), ethers.parseEther("10"));
      await expect(
        staking["stake(address,uint256)"](
          owner.address,
          ethers.parseEther("100")
        )
      ).to.be.revertedWithCustomError(ciphex, "ERC20InsufficientAllowance");
    });
    it("Must stake correctly", async () => {
      const toStake = stakeData.days[1].stakes[0];
      const expRewards = stakeData.expectedRewards[1];
      await ciphex.approve(await staking.getAddress(), toStake);
      const tx: ContractTransactionResponse = await staking[
        "stake(address,uint256)"
      ](owner.address, toStake);
      expect(tx)
        .to.emit(staking, "StakeCreated")
        .withArgs(1, owner.address, toStake);
      expect(await staking.requiredRewards()).to.be.equal(expRewards);
      expect(await staking.totalStakedAmount()).to.be.equal(toStake);
      expect(await staking.getUserStakes(owner.address)).to.be.deep.equal([1]);
      expect(await staking.stakes(1)).to.be.deep.equal([
        owner.address,
        toStake,
        0n,
        rewardIndex,
        expRewards,
        await time.latest(),
        0n,
      ]);
    });
  });
  describe("rewards calculations", async () => {
    afterEach(async () => {
      await startSnapshot.restore();
    });
    it("Must calculate rewards correctly", async () => {
      let toTransfer = stakeData.days[1].stakes[0];
      await ciphex.approve(await staking.getAddress(), toTransfer);
      await staking["stake(address,uint256)"](
        owner.address,
        stakeData.days[1].stakes[0]
      );
      expect((await staking.stakes(1)).earnedRewards).to.be.equal(
        stakeData.expectedRewards[1]
      );
      expect(await staking.requiredRewards()).to.be.equal(
        stakeData.expectedRewards[1]
      );
    });
  });
  describe("claimRewards", async () => {
    let expRewards: bigint;
    let expRewardsX2: bigint;
    beforeEach(async () => {
      const toStake = stakeData.days[1].stakes[0];
      expRewards = stakeData.expectedRewards[1];
      expRewardsX2 = stakeData.expectedRewards[1] * 2n;
      await ciphex.approve(await staking.getAddress(), toStake * 2n);
      await staking["stake(address,uint256)"](owner.address, toStake);
      await staking["stake(address,uint256)"](owner.address, toStake);
    });
    afterEach(async () => {
      await startSnapshot.restore();
    });
    it("Must revert if sender isn't owner of stake", async () => {
      await expect(
        staking.connect(user1)["claimRewards(uint256)"](1)
      ).to.be.revertedWithCustomError(staking, "NotStakeOwner");
    });
    it("Must revert if sender isn't owner of one of passed stakes", async () => {
      await expect(
        staking.connect(user1)["claimRewards(uint256[])"]([1, 2])
      ).to.be.revertedWithCustomError(staking, "NotStakeOwner");
    });
    it("Must revert if stake with passed id doesn't exist", async () => {
      await expect(
        staking["claimRewards(uint256)"](10)
      ).to.be.revertedWithCustomError(staking, "InvalidStakeId");
    });
    it("Must revert if at least one passed id doesn't exist", async () => {
      await expect(
        staking["claimRewards(uint256[])"]([10, 1])
      ).to.be.revertedWithCustomError(staking, "InvalidStakeId");
    });
    it("Must revert if sender tries to claim rewards before lock end", async () => {
      await expect(
        staking["claimRewards(uint256)"](1)
      ).to.be.revertedWithCustomError(staking, "RewardsAreLocked");
    });
    it("Must revert if stake doesn't have rewards or it was already claimed", async () => {
      await time.increase(time.duration.days(180));
      await ciphex.approve(await staking.getAddress(), expRewards);
      await staking.depositRewards(expRewards);
      await staking["claimRewards(uint256)"](1);
      expect(staking["claimRewards(uint256)"](1)).to.be.revertedWithCustomError(
        staking,
        "ZeroValue"
      );
    });
    it("Must revert if staking SC doesn't have enough rewards to transfer", async () => {
      await time.increase(time.duration.days(180));
      expect(staking["claimRewards(uint256)"](1)).to.be.revertedWithCustomError(
        ciphex,
        "ERC20InsufficientBalance"
      );
    });
    it("Must claim rewards correctly", async () => {
      await time.increase(time.duration.days(180));
      await ciphex.approve(await staking.getAddress(), expRewards);
      await staking.depositRewards(expRewards);
      expect(await staking["claimRewards(uint256)"](1))
        .to.emit(staking, "RewardsClaimed")
        .withArgs(1, owner.address, expRewards);
      expect(await staking.rewardAmount()).to.be.equal(0);
      expect((await staking.stakes(1)).earnedRewards).to.be.equal(0);
    });
    it("Must claim multiple rewards correctly", async () => {
      await time.increase(time.duration.days(180));
      await ciphex.approve(await staking.getAddress(), expRewardsX2);
      await staking.depositRewards(expRewardsX2);
      let tx = await staking["claimRewards(uint256[])"]([1, 2]);
      expect(tx)
        .to.emit(staking, "RewardsClaimed")
        .withArgs(1, owner.address, expRewards);
      expect(tx)
        .to.emit(staking, "RewardsClaimed")
        .withArgs(2, owner.address, expRewards);
      expect(await staking.rewardAmount()).to.be.equal(0);
      expect((await staking.stakes(1)).earnedRewards).to.be.equal(0);
      expect((await staking.stakes(2)).earnedRewards).to.be.equal(0);
    });
  });
  describe("vesting", async () => {
    describe("getWithdrawableTokens before lock end", async () => {
      it("Must returns 0", async () => {
        const toStake = vestingData.defDeposit;
        await staking.setVestingRates(vestingData.vestingRates);
        await ciphex.approve(await staking.getAddress(), toStake);
        await staking["stake(address,uint256)"](owner.address, toStake);
        expect(await staking.getWithdrawableAmount(1)).to.be.equal(0);
        await startSnapshot.restore();
      });
    });
    describe("getWithdrawableTokens", async () => {
      beforeEach(async () => {
        const toStake = vestingData.defDeposit;
        await staking.setVestingRates(vestingData.vestingRates);
        await ciphex.approve(await staking.getAddress(), toStake);
        await staking["stake(address,uint256)"](owner.address, toStake);
        await time.increase(time.duration.days(180));
      });
      afterEach(async () => {
        await startSnapshot.restore();
      });
      it("Must calculates withdrawable amount without withdraw", async () => {
        for (let i = 0; i < 12; i++) {
          expect(await staking.getWithdrawableAmount(1)).to.be.equal(
            vestingData.withdrawableWithoutWithdraw[i]
          );
          await time.increase(time.duration.days(30));
        }
      });
      it("Must calculates withdrawable amount with each month withdraw", async () => {
        for (let i = 0; i < 12; i++) {
          expect(await staking.getWithdrawableAmount(1)).to.be.closeTo(
            vestingData.withdrawableWithWithdraw[i],
            ethers.parseUnits("1", 14)
          );
          await staking.unstake(1, 0);
          await time.increase(time.duration.days(30));
        }
      });
      it("Must calculates withdrawable amount with withdraw with custom vesting rates", async () => {
        await staking.setVestingRates([
          ethers.parseEther("0.03"),
          ethers.parseEther("1"),
          ethers.parseEther("0.0406"),
          ethers.parseEther("0.0631"),
          ethers.parseEther("0.0721"),
          ethers.parseEther("0.0789"),
          ethers.parseEther("0.1169"),
          ethers.parseEther("0.1379"),
          ethers.parseEther("0.1974"),
          ethers.parseEther("0.2524"),
          ethers.parseEther("0.3924"),
          ethers.parseEther("1"),
        ]);
        expect(await staking.getWithdrawableAmount(1)).to.be.equal(
          vestingData.withdrawableWithoutWithdraw[0]
        );
        await staking.unstake(1, 0);
        await time.increase(time.duration.days(30));
        expect(await staking.getWithdrawableAmount(1)).to.be.equal(
          vestingData.defDeposit - vestingData.withdrawableWithoutWithdraw[0]
        );
        await staking.unstake(1, 0);
        await time.increase(time.duration.days(30));
        for (let i = 2; i <= 12; i++) {
          expect(await staking.getWithdrawableAmount(1)).to.be.equal(0);
          await time.increase(time.duration.days(30));
        }
      });
      it("Must return 0 if user has claimed in the month", async () => {
        await staking.unstake(1, 0);
        expect(await staking.getWithdrawableAmount(1)).to.be.equal(0);
      });
      it("Must return 100% of stake after 12 months", async () => {
        await time.increase(time.duration.days(360));
        expect(await staking.getWithdrawableAmount(1)).to.be.equal(
          vestingData.defDeposit
        );
      });
    });
    describe("unstake", async () => {
      let toStake: bigint;
      let rewardIndex: bigint;
      let expRewards: bigint;
      let expRewardsX2: bigint;
      let stakeTimestamp: number;
      beforeEach(async () => {
        toStake = vestingData.defDeposit;
        rewardIndex = stakeData.days[1].rewardIndex;
        expRewards = stakeData.expectedRewards[1];
        expRewardsX2 = stakeData.expectedRewards[1] * 2n;
        await staking.setVestingRates(vestingData.vestingRates);
        await ciphex.approve(await staking.getAddress(), toStake * 2n);
        await staking["stake(address,uint256)"](user1.address, toStake);
        stakeTimestamp = await time.latest();
        await staking["stake(address,uint256)"](user1.address, toStake);
        await time.increase(time.duration.days(180));
      });
      afterEach(async () => {
        await startSnapshot.restore();
      });
      it("Must revert if sender isn't stake owner", async () => {
        await expect(staking.unstake(1, 0)).to.be.revertedWithCustomError(
          staking,
          "NotStakeOwner"
        );
      });
      it("Must revert if sender isn't stake owner (multiple)", async () => {
        await expect(
          staking.unstakes([1, 2], [0, 0])
        ).to.be.revertedWithCustomError(staking, "NotStakeOwner");
      });
      it("Must revert if staked doesn't exist", async () => {
        await expect(
          staking.unstakes([10, 1], [0, 0])
        ).to.be.revertedWithCustomError(staking, "InvalidStakeId");
      });
      it("Must revert if arrays have different length", async () => {
        await expect(
          staking.unstakes([1, 2], [0])
        ).to.be.revertedWithCustomError(staking, "LenghMistmatch");
      });
      it("Must revert if withdrawable amount equals to 0", async () => {
        await staking.connect(user1).unstake(1, 0);
        await expect(
          staking.connect(user1).unstake(1, 0)
        ).to.be.revertedWithCustomError(staking, "NotEnoughAvailableTokens");
      });
      it("Must revert if withdrawable amount equals to 0  (multiple)", async () => {
        await staking.connect(user1).unstakes([1, 2], [0, 0]);
        await expect(
          staking.connect(user1).unstakes([1, 2], [0, 0])
        ).to.be.revertedWithCustomError(staking, "NotEnoughAvailableTokens");
      });
      it("Must revert after vesting period after first unstake of all tokens", async () => {
        await time.increase(time.duration.days(390));
        await staking.connect(user1).unstake(1, 0);
        await expect(
          staking.connect(user1).unstake(1, 0)
        ).to.be.revertedWithCustomError(staking, "NotEnoughAvailableTokens");
      });
      it("Must revert if withdrawable amount is less than required amount", async () => {
        await expect(
          staking.connect(user1).unstake(1, ethers.parseEther("1000"))
        ).to.be.revertedWithCustomError(staking, "NotEnoughAvailableTokens");
      });
      it("Must unstake specific amount of ciphex tokens", async () => {
        const expWithdrawable = vestingData.withdrawableWithWithdraw[0];
        const toWithdraw = ethers.parseEther("100");
        expect(await staking.getWithdrawableAmount(1)).to.be.equal(
          expWithdrawable
        );
        expect(await staking.connect(user1).unstake(1, toWithdraw));
        expect(await staking.stakes(1)).to.be.deep.equal([
          user1.address,
          toStake,
          toWithdraw,
          rewardIndex,
          expRewards * 10n,
          stakeTimestamp,
          1n,
        ]);
        expect(await ciphex.balanceOf(user1.address)).to.be.equal(toWithdraw);
      });
      it("Must unstake all available amount of ciphex tokens", async () => {
        const expWithdrawable = vestingData.withdrawableWithWithdraw[0];
        expect(await staking.getWithdrawableAmount(1)).to.be.equal(
          expWithdrawable
        );
        expect(await staking.connect(user1).unstake(1, 0));
        expect(await staking.stakes(1)).to.be.deep.equal([
          user1.address,
          toStake,
          expWithdrawable,
          rewardIndex,
          expRewards * 10n,
          stakeTimestamp,
          1n,
        ]);
        expect(await ciphex.balanceOf(user1.address)).to.be.equal(
          expWithdrawable
        );
      });
    });
  });
  describe("depositRewards", async () => {
    it("Must revert if sender isn't owner", async () => {
      await expect(
        staking.connect(user1).depositRewards(ethers.parseEther("1"))
      ).to.be.revertedWithCustomError(staking, "OwnableUnauthorizedAccount");
    });
    it("Must revert passed amount equals 0", async () => {
      await expect(
        staking.depositRewards(ethers.parseEther("0"))
      ).to.be.revertedWithCustomError(staking, "ZeroValue");
    });
  });
  describe("setVestingRates", async () => {
    after(async () => {
      await startSnapshot.restore();
    });
    it("Must revert is sender isn't owner or chainlink automation", async () => {
      await expect(
        staking
          .connect(user1)
          .setVestingRates([1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1])
      ).to.be.revertedWithCustomError(staking, "OwnableUnauthorizedAccount");
    });
    it("Must revert if passed array doesn't have 12 elements", async () => {
      await expect(
        staking.setVestingRates([1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1])
      ).to.be.revertedWithCustomError(staking, "InvalidVestingRatesLengh");
    });
    it("Must revert if last element doesn't equals 100% (1 eth)", async () => {
      await expect(
        staking.setVestingRates([
          1,
          1,
          1,
          1,
          1,
          1,
          1,
          1,
          1,
          1,
          1,
          ethers.parseEther("0.9"),
        ])
      ).to.be.revertedWithCustomError(staking, "InvalidVestingRate");
    });
    it("Must revert if one of elements equals 0", async () => {
      await expect(
        staking.setVestingRates([
          1,
          1,
          1,
          1,
          0,
          1,
          1,
          1,
          1,
          1,
          1,
          ethers.parseEther("1"),
        ])
      ).to.be.revertedWithCustomError(staking, "ZeroValue");
    });
    it("Must revert if one of elements greater than 100%", async () => {
      await expect(
        staking.setVestingRates([
          1,
          1,
          1,
          1,
          ethers.parseEther("1.1"),
          1,
          1,
          1,
          1,
          1,
          1,
          ethers.parseEther("1"),
        ])
      ).to.be.revertedWithCustomError(staking, "InvalidVestingRate");
    });
  });
});
