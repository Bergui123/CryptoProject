import "@nomicfoundation/hardhat-toolbox-mocha-ethers";

export default {
  solidity: "0.8.28",
  networks: {
    hardhat: {
      type: "edr-simulated"
    }
  }
};
