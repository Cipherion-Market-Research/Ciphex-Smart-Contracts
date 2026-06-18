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
let owner: SignerWithAddress;
let user1: SignerWithAddress;
let user2: SignerWithAddress;
let startSnapshot: SnapshotRestorer;
let ciphex: Ciphex;
let CiphexFactory: Ciphex__factory;
let ProxyFactory: ProxyMock__factory;
describe("Ciphex", async () => {
  before(async () => {
    [owner, user1, user2] = await ethers.getSigners();
    CiphexFactory = (await ethers.getContractFactory(
      "Ciphex"
    )) as Ciphex__factory;
    ProxyFactory = (await ethers.getContractFactory(
      "ProxyMock"
    )) as ProxyMock__factory;
    ciphex = await CiphexFactory.deploy();
    const ciphexProxy = await ProxyFactory.deploy(
      await ciphex.getAddress(),
      "0x"
    );
    ciphex = (await CiphexFactory.attach(
      await ciphexProxy.getAddress()
    )) as Ciphex;
    await ciphex.initialize(owner.address, owner.address);
    startSnapshot = await takeSnapshot();
  });
  describe("grantRole", async () => {
    after(async () => {
      await startSnapshot.restore();
    });
    it("Must revert if sender isn't default admin", async () => {
      await expect(
        ciphex
          .connect(user1)
          .grantRole(await ciphex.PAUSER_ROLE(), user1.address)
      ).to.be.revertedWithCustomError(
        ciphex,
        "AccessControlUnauthorizedAccount"
      );
    });
    it("Must grant pauser role correctly", async () => {
      expect(
        await ciphex.grantRole(await ciphex.PAUSER_ROLE(), user1.address)
      ).to.be.emit(ciphex, "RoleGranted");
      expect(await ciphex.hasRole(await ciphex.PAUSER_ROLE(), user1.address)).to
        .be.true;
    });
  });
  describe("pause & unpause", async () => {
    beforeEach(async () => {
      await ciphex.grantRole(await ciphex.PAUSER_ROLE(), user2.address);
    });
    afterEach(async () => {
      await startSnapshot.restore();
    });
    it("Must revert if sender doesn't have pauser role", async () => {
      await expect(ciphex.connect(user1).pause()).to.be.revertedWithCustomError(
        ciphex,
        "AccessControlUnauthorizedAccount"
      );
      await expect(
        ciphex.connect(user1).unpause()
      ).to.be.revertedWithCustomError(
        ciphex,
        "AccessControlUnauthorizedAccount"
      );
    });
    it("Must pause correctly", async () => {
      expect(await ciphex.connect(user2).pause())
        .to.be.emit(ciphex, "Paused")
        .withArgs(user2.address);
    });
    it("Must unpause correctly", async () => {
      await ciphex.connect(user2).pause();
      expect(await ciphex.connect(user2).unpause())
        .to.be.emit(ciphex, "Unpaused")
        .withArgs(user2.address);
    });
    it("Must execute transfer correctly when unpaused", async () => {
      await ciphex.transfer(user1.address, 1);
      expect(await ciphex.balanceOf(user1)).to.be.equal(1);
    });
    it("Must revert on transfer when paused", async () => {
      await ciphex.connect(user2).pause();
      await expect(
        ciphex.transfer(user1.address, 1)
      ).to.be.revertedWithCustomError(ciphex, "EnforcedPause");
    });
  });
});
