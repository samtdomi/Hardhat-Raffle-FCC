const { getNamedAccounts, network, ethers } = require("hardhat")
const { developmentChains, networkConfig } = require("../helper-hardhat-config")
const { verify } = require("../utils/verify")

module.exports = async ({ getNamedAccount, deployments }) => {
    const { deploy, log } = deployments
    const { deployer } = await getNamedAccounts()
    const chainId = network.config.chainId

    const VRF_MOCK_SUBSCRIPTION_FUND_AMOUNT = ethers.utils.parseEther("30")

    // arguments for raffle constructor
    let vrfCoordinatorV2Address
    let vrfCoordinatorV2Mock
    const entranceFee = networkConfig[chainId]["entranceFee"]
    const gasLane = networkConfig[chainId]["gasLane"]
    let subscriptionId
    const callbackGasLimit = networkConfig[chainId]["callbackGasLimit"]
    const interval = networkConfig[chainId]["interval"]

    if (developmentChains.includes(network.name)) {
        vrfCoordinatorV2Mock = await ethers.getContract("VRFCoordinatorV2Mock")
        vrfCoordinatorV2Address = vrfCoordinatorV2Mock.address
        /* the output of the "createSubscription" function of the "VRFCoordinatorV2Mock" contract
         *  is an event that returns a new created subscription for the purpose of using it on a mock
         *  we create and fund dynamic subscription here without the need for UI */
        const transactionResponse = await vrfCoordinatorV2Mock.createSubscription()
        const transactionReceipt = await transactionResponse.wait(1)
        subscriptionId = transactionReceipt.events[0].args.subId
        await vrfCoordinatorV2Mock.fundSubscription(
            subscriptionId,
            VRF_MOCK_SUBSCRIPTION_FUND_AMOUNT
        )
    } else {
        vrfCoordinatorV2Address = networkConfig[chainId]["vrfCoordinatorV2"]
        subscriptionId = networkConfig[chainId]["subscriptionId"]
    }

    // args are the arguments needed to be passed in to the constructor of the "raffle" contract
    const args = [
        vrfCoordinatorV2Address,
        entranceFee,
        gasLane,
        subscriptionId,
        callbackGasLimit,
        interval,
    ]

    const raffle = await deploy("Raffle", {
        from: deployer,
        args: args,
        log: true,
        waitConfirmations: network.config.blockConfirmations || 1,
    })

    // Verify On Etherscan
    if (!developmentChains.includes(network.name) && process.env.ETHERSCAN_API_KEY) {
        log("Verifying on Etherscan.....")
        await verify(raffle.address, args)
    }

    log("------------------------------------")
}

module.exports.tags = ["all", "raffle"]
