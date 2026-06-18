import { ethers } from "ethers";
// you can check the google tables by the link: https://docs.google.com/spreadsheets/d/17geiYlTQRRp1VzasS3BI5rLT99AIPX87hAE_lrip7UI/edit?usp=sharing
export const presaleData = {
  priceCases: [
    {
      initialPrice: ethers.parseUnits("0.1", 6),
      days: {
        "1": {
          price: ethers.parseUnits("0.1", 6),
          ethPerOne: ethers.parseEther("0.00003818380853"),
          ethInMin: ethers.parseEther("0.07636761706"),
        },
        "2": {
          price: ethers.parseUnits("0.10089", 6),
          ethPerOne: ethers.parseEther("0.00003852364443"),
          ethInMin: ethers.parseEther("0.07704728885"),
        },
        "3": {
          price: ethers.parseUnits("0.10178", 6),
          ethPerOne: ethers.parseEther("0.00003886348032"),
          ethInMin: ethers.parseEther("0.07772696064"),
        },
        "5": {
          price: ethers.parseUnits("0.10356", 6),
          ethPerOne: ethers.parseEther("0.00003954315211"),
          ethInMin: ethers.parseEther("0.07908630423"),
        },
        "10": {
          price: ethers.parseUnits("0.10801", 6),
          ethPerOne: ethers.parseEther("0.00004124233159"),
          ethInMin: ethers.parseEther("0.08248466319"),
        },
        "15": {
          price: ethers.parseUnits("0.11246", 6),
          ethPerOne: ethers.parseEther("0.00004294151107"),
          ethInMin: ethers.parseEther("0.08588302215"),
        },
        "30": {
          price: ethers.parseUnits("0.12581", 6),
          ethPerOne: ethers.parseEther("0.00004803904951"),
          ethInMin: ethers.parseEther("0.09607809902"),
        },
        "60": {
          price: ethers.parseUnits("0.15251", 6),
          ethPerOne: ethers.parseEther("0.00005823412639"),
          ethInMin: ethers.parseEther("0.1164682528"),
        },
        "120": {
          price: ethers.parseUnits("0.20591", 6),
          ethPerOne: ethers.parseEther("0.00007862428014"),
          ethInMin: ethers.parseEther("0.1572485603"),
        },
        "180": {
          price: ethers.parseUnits("0.25931", 6),
          ethPerOne: ethers.parseEther("0.0000990144339"),
          ethInMin: ethers.parseEther("0.1980288678"),
        },
        "181": {
          price: ethers.parseUnits("0.26", 6),
          ethPerOne: ethers.parseEther("0.00009927790218"),
          ethInMin: ethers.parseEther("0.1987085396"),
        },
      },
    },
  ],
};
export const stakeData = {
  days: {
    "1": {
      rewardIndex: ethers.parseUnits("0.1122", 6),
      stakes: [ethers.parseEther("1000"), ethers.parseEther("3000")],
    },
    "31": {
      rewardIndex: ethers.parseUnits("0.111", 6),
      stakes: [ethers.parseEther("7000")],
    },
    "61": {
      rewardIndex: ethers.parseUnits("0.1119", 6),
      stakes: [ethers.parseEther("500"), ethers.parseEther("2000")],
    },
    "91": {
      rewardIndex: ethers.parseUnits("0.1125", 6),
      stakes: [ethers.parseEther("1000")],
    },
    "121": {
      rewardIndex: ethers.parseUnits("0.1131", 6),
      stakes: [],
    },
    "151": {
      rewardIndex: ethers.parseUnits("0.1122", 6),
      stakes: [ethers.parseEther("2500")],
    },
    "181": {
      rewardIndex: ethers.parseUnits("0.114", 6),
      stakes: [ethers.parseEther("4500")],
    },
    "211": {
      rewardIndex: ethers.parseUnits("0.114", 6),
      stakes: [],
    },
    "241": {
      rewardIndex: ethers.parseUnits("0.1137", 6),
      stakes: [],
    },
    "271": {
      rewardIndex: ethers.parseUnits("0.1131", 6),
      stakes: [],
    },
    "301": {
      rewardIndex: ethers.parseUnits("0.1125", 6),
      stakes: [],
    },
    "331": {
      rewardIndex: ethers.parseUnits("0.1122", 6),
      stakes: [],
    },
  },
  expectedRewards: {
    "1": ethers.parseEther("112.2"),
    "2": ethers.parseEther("1009.8"),
    "3": ethers.parseEther("2331"),
    "4": ethers.parseEther("167.85"),
    "5": ethers.parseEther("671.4"),
    "6": ethers.parseEther("337.5"),
    "7": ethers.parseEther("841.5"),
    "8": ethers.parseEther("1539"),
  },
};
export const vestingData = {
  defDeposit: ethers.parseEther("10000"),
  vestingRates: [
    ethers.parseEther("0.03"),
    ethers.parseEther("0.0351"),
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
  ],
  withdrawableWithoutWithdraw: [
    ethers.parseEther("300"),
    ethers.parseEther("351"),
    ethers.parseEther("406"),
    ethers.parseEther("631"),
    ethers.parseEther("721"),
    ethers.parseEther("789"),
    ethers.parseEther("1169"),
    ethers.parseEther("1379"),
    ethers.parseEther("1974"),
    ethers.parseEther("2524"),
    ethers.parseEther("3924"),
    ethers.parseEther("10000"),
  ],
  withdrawableWithWithdraw: [
    ethers.parseEther("300"),
    ethers.parseEther("340.47"),
    ethers.parseEther("379.996918"),
    ethers.parseEther("566.6085375"),
    ethers.parseEther("606.5718597"),
    ethers.parseEther("615.9212268"),
    ethers.parseEther("840.5614374"),
    ethers.parseEther("875.6470758"),
    ethers.parseEther("1080.611609"),
    ethers.parseEther("1108.947501"),
    ethers.parseEther("1288.902089"),
    ethers.parseEther("1995.761746"),
  ],
};
