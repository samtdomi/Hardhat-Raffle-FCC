const { assert, expect } = require("chai")
const { ethers, getNamedAccounts, deployments, network } = require("hardhat")
const { developmentChains, networkConfig } = require("../helper-hardhat-config")

/* if(!developmentChains.includes(network.name)) {
 *  describe.skip
 * } else { describe("Raffle" , async function()
 * )}
 */
!developmentChains.includes(network.name)
    ? describe.skip
    : describe("Raffle Unit Tests", function () {
          let raffle, vrfCoordinatorV2Mock, raffleEntranceFee, deployer, interval
          const chainId = network.config.chainId

          // before each function block gets tested, do this
          beforeEach(async function () {
              deployer = (await getNamedAccounts()).deployer
              await deployments.fixture(["all"])
              raffle = await ethers.getContract("Raffle", deployer)
              vrfCoordinatorV2Mock = await ethers.getContract("VRFCoordinatorV2Mock")
              raffleEntranceFee = await raffle.getEntranceFee()
              interval = await raffle.getInterval()
          })

          describe("constructor", function () {
              it("Initializes the raffle correctly", async function () {
                  // Arrange
                  // Act
                  const raffleState = await raffle.getRaffleState()
                  // Assert
                  assert.equal(raffleState.toString(), "0")
                  assert.equal(interval.toString(), networkConfig[chainId]["interval"])
              })
          }) // end of constructor function tests

          describe("enterRaffle", function () {
              it("reverts when you dont pay enough", async function () {
                  // Arrange
                  // Act
                  // Assert
                  await expect(raffle.enterRaffle()).to.be.revertedWith(
                      "Raffle__NotEnoughETHEntered"
                  )
              })

              it("records players and adds them to array when they enter", async function () {
                  // Arrange
                  let players
                  // Act
                  await raffle.enterRaffle({ value: raffleEntranceFee })
                  players = await raffle.getNumberOfPlayers()
                  const playerFromContract = await raffle.getPlayers(0)
                  // Assert
                  assert.equal(players, 1) // checks to see if length of array goes from 0 to 1
                  assert.equal(playerFromContract, deployer) // checks to see if array adds the "deployer" address
              })

              it("emits event when someone enters raffle", async function () {
                  await expect(raffle.enterRaffle({ value: raffleEntranceFee })).to.emit(
                      raffle,
                      "RaffleEnter"
                  )
              })

              it("doesnt allow entrance when RaffleState is Calculating", async function () {
                  // first make sure checkupkeep is true to be able to run performUpkeep and change raffleState
                  await raffle.enterRaffle({ value: raffleEntranceFee })
                  await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
                  await network.provider.send("evm_mine", [])
                  // We change raffleState to calculating
                  await raffle.performUpkeep([])
                  // shouldnt be able to enter because raffleState is calculating
                  await expect(raffle.enterRaffle({ value: raffleEntranceFee })).to.be.revertedWith(
                      "Raffle__NotOpen"
                  )
              })
          }) // end of "enterRaffle" function tests

          describe("checkUpkeep", function () {
              it("returns false if no one has entered and sent ETH", async function () {
                  // Arrange
                  // Act
                  await network.provider.send("evm_increaseTime", [interval.toNumber() + 1]) // increases time of network
                  await network.provider.send("evm_mine", []) // mine a block to update the block.timestamp
                  const { upkeepNeeded } = await raffle.callStatic.checkUpkeep("0x")
                  // Assert
                  assert(!upkeepNeeded) // true if upkeepNeeded returns false
              })

              it("returns false if raffle isnt open", async function () {
                  // Arrange
                  // Act
                  await raffle.enterRaffle({ value: raffleEntranceFee })
                  await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
                  await network.provider.send("evm_mine", [])
                  await raffle.performUpkeep("0x") // changes state to calculating
                  const raffleState = await raffle.getRaffleState() // should be "1" for 1 index of the enum RaffleState
                  const { upkeepNeeded } = await raffle.callStatic.checkUpkeep("0x")
                  // Assert
                  assert.equal(raffleState.toString(), "1")
                  assert.equal(upkeepNeeded, false) // upkeepNeeded should return false
              })

              it("returns false if enough time hasnt passed", async function () {
                  // Arrange
                  // Act
                  await raffle.enterRaffle({ value: raffleEntranceFee })
                  await network.provider.send("evm_increaseTime", [interval.toNumber() - 8])
                  await network.provider.send("evm_mine", [])
                  const { upkeepNeeded } = await raffle.callStatic.checkUpkeep("0x")
                  // Assert
                  assert(!upkeepNeeded)
              })

              it("returns true if enough time has passed, players have entered, contract has ETH, and raffleState is open ", async function () {
                  // Arrange
                  await raffle.enterRaffle({ value: raffleEntranceFee })
                  await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
                  await network.provider.send("evm_mine", [])
                  // Act
                  const { upkeepNeeded } = await raffle.callStatic.checkUpkeep("0x")
                  // Assert
                  assert(upkeepNeeded)
              })
          }) // end of "checkUpkeep" function tests

          describe("performUpkeep", function () {
              it("can only run if checkUpkeep is true", async function () {
                  // Arrange
                  await raffle.enterRaffle({ value: raffleEntranceFee })
                  await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
                  await network.provider.send("evm_mine", [])
                  // Act
                  const tx = await raffle.performUpkeep("0x")
                  // Assert
                  assert(tx)
              })

              it("should revert if checkUpkeep is false and upkeep is not needed", async function () {
                  // Arrange
                  // Act
                  // Assert
                  await expect(raffle.performUpkeep([])).to.be.revertedWith(
                      "Raffle__UpkeepNotNeeded"
                  )
              })

              it("should change RaffleState to calculating", async function () {
                  // Arrange
                  await raffle.enterRaffle({ value: raffleEntranceFee })
                  await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
                  await network.provider.send("evm_mine", [])
                  // Act
                  await raffle.performUpkeep([])
                  const raffleState = await raffle.getRaffleState()
                  // Assert
                  assert.equal(raffleState.toString(), "1")
              })

              it("should call vrfCoordinator and populate requestId by emitting requestedRaffleWinner event", async function () {
                  // Arrange
                  await raffle.enterRaffle({ value: raffleEntranceFee })
                  await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
                  await network.provider.send("evm_mine", [])
                  // Act
                  const txResponse = await raffle.performUpkeep([])
                  const txReceipt = await txResponse.wait(1)
                  // the 0th index event is the event that gets emit in the vrfCoordinator contract
                  // the 1 index event is the second event emit in the performUpkeep function
                  // which is the requestedRaffleWinner in raffle.performUpkeep()
                  const requestId = txReceipt.events[1].args.requestId
                  // Assert
                  assert(requestId.toNumber() > 0)
              })
          }) // end of "performUpkeep" function tests

          describe("fulfillRandomWords", function () {
              // make sure that checkUpkeep is true before each "it" test
              beforeEach(async function () {
                  await raffle.enterRaffle({ value: raffleEntranceFee })
                  await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
                  await network.provider.send("evm_mine", [])
              })

              it("can only be called after performUpkeep", async function () {
                  await expect(
                      vrfCoordinatorV2Mock.fulfillRandomWords(0, raffle.address)
                  ).to.be.revertedWith("nonexistent request")
                  await expect(
                      vrfCoordinatorV2Mock.fulfillRandomWords(1, raffle.address)
                  ).to.be.revertedWith("nonexistent request")
              })

              // Wayyyy too big of a test, should be broken down into pieces
              it("picks a winner, resets the lottery via array and lastTimestamp, and send money ", async function () {
                  // Arrange
                  const additionalEntrants = 3 // more accounts to enter the raffle
                  const startingAccountIndex = 1 // deployer = 0
                  const accounts = await ethers.getSigners()

                  // Act
                  for (
                      let i = startingAccountIndex;
                      i < startingAccountIndex + additionalEntrants;
                      i++
                  ) {
                      const accountConnectedRaffle = await raffle.connect(accounts[i])
                      await accountConnectedRaffle.enterRaffle({ value: raffleEntranceFee })
                  }

                  const startingTimeStamp = await raffle.getLatestTimeStamp() // used to check update of lastTimeStamp

                  // we need to call and run performUpkeep(mock being chainlink keepers) first,
                  // which will internally call fulfillRandomWords (mock being chainlink vrf)
                  // we need to create a listener and force the test to wait until its done listening
                  // which is when fulfillRandomWords gets called and finishes and emits event "WinnerPicked"
                  // we are mocking the actual process and chain of events as it will happen on mainnet
                  await new Promise(async (resolve, reject) => {
                      // line below is the listener, its activated ONLY when fulfilRandomWords emits WinnerPicked event
                      raffle.once("WinnerPicked", async () => {
                          console.log("Found the event!!!!")
                          try {
                              const recentWinner = await raffle.getRecentWinner()
                              const raffleState = await raffle.getRaffleState()
                              const players = await raffle.getPlayers()
                              const numPlayers = await raffle.getNumberOfPlayers()
                              const endingTimeStamp = await raffle.getLatestTimeStamp()

                              assert.equal(raffle.getBalance().toString(), "0")
                              assert.equal(raffleState.toString(), "0")
                              assert.equal(numPlayers.toString(), "0")
                              assert(!recentWinner == "0x")
                              assert(endingTimeStamp > startingTimeStamp)
                              await expect(players(0)).to.be.reverted
                              resolve()
                          } catch (e) {
                              reject(e)
                          }
                      })
                      // imitates the process in which these transactions will happen on a testnet/mainnet
                      const tx = await raffle.performUpkeep([])
                      const txReceipt = await tx.wait(1)
                      const requestId = txReceipt.events[1].args.requestId
                      // calls the mock fulfillRandomWords function from the vrfCoordinatorV2Mock
                      // and emits WinnerPicked event which will activate the listener and run code inside it
                      await vrfCoordinatorV2Mock.fulfillRandomWords(requestId, raffle.address)
                  })
              })
          }) // end of "fulfillRandomWords tests"
      }) // end of ENTIRE raffle contract tests
