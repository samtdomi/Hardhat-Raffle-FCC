/* The purpose of this deploy mock script is to deploy
 * the specific chainlink Mock VRFCoordinatorV2Mock contract
 * so that we can get the address of it on the main deploy
 * script to pass it in as a constructor argument for when
 * deploying and testing on a local network */

const { network } = require("hardhat")
const { developmentChains } = require("../helper-hardhat-config")

module.exports = async ({ getNamedAccounts, deployments }) => {
    const { deploy, log } = deployments
    const { deployer } = await getNamedAccounts()
    const chainId = network.config.chainId

    // 0.25 is the premium. it costs 0.25 LINK per random number request
    const BASE_FEE = ethers.utils.parseEther("0.25")
    // calculated value based on the gas price of the chain
    const GAS_PRICE_LINK = 1e9 // 1000000000
    // Arguments
    const args = [BASE_FEE, GAS_PRICE_LINK]

    if (developmentChains.includes(network.name)) {
        log("Local network detected! Deploying mocks...")
        await deploy("VRFCoordinatorV2Mock", {
            from: deployer,
            log: true,
            // Constructor of vrf contract takes 2 paramaters, _baseFee & _gasPriceLink
            args: args,
        })
    }
}

module.exports.tags = ["all", "mocks"]
