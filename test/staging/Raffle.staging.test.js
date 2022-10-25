// to run staging test on a test network:
// 1. Get our SubId for Chainlink VRF
// 2. Deploy our contract using the SubId
// 3. Register the contract with Chainlink VRF and it's SubId
// 4. Register the contract with Chainlink Keepers
// 5. Run staging Test's

const { assert, expect } = require("chai")
const { ethers, getNamedAccounts, deployments, network } = require("hardhat")
const { developmentChains, networkConfig } = require("../../helper-hardhat-config")

developmentChains.includes(network.name)
    ? describe.skip
    : describe("Raffle Staging Tests", function () {
          let raffle, raffleEntranceFee, deployer

          // before each function block gets tested, do this
          beforeEach(async function () {
              deployer = (await getNamedAccounts()).deployer
              // await deployments.fixture(["all"]) <-- dont need on test net only localhost
              raffle = await ethers.getContract("Raffle", deployer)
              raffleEntranceFee = await raffle.getEntranceFee()
          })

          describe("fulfillRandomWords", async function () {
              it("works with live Chainlink Keepers, Chainlink VRF, and we get a random winner", async function () {
                  // Enter the Lottery with mulitple accounts
                  // Setup Listener before entering the lottery in case blockchain moves FAST
                  const startingTimeStamp = await raffle.getLatestTimeStamp()
                  const startingAccountIndex = 1
                  const additionalEntrants = 3
                  const accounts = await ethers.getSigners()

                  await new Promise(async (resolve, reject) => {
                      // Listener, once WinnerPicked, code inside will run
                      raffle.once("WinnerPicked", async () => {
                          console.log("winner picked, event fired!!!")
                          try {
                              // Arrange
                              const recentWinner = await raffle.getRecentWinner()
                              const raffleState = await raffle.getRaffleState()
                              const winnerEndingBalance = await accounts[0].getBalance() // deployer is account[0]
                              const numPlayers = await raffle.getNumberOfPlayers()
                              const endingTimeStamp = await raffle.getLatestTimeStamp()
                              // Assert
                              assert.equal(raffleState.toString(), "0")
                              assert.equal(
                                  winnerEndingBalance.toString(),
                                  winnerStartingBalance.add(raffleEntranceFee).toString()
                              )
                              assert.equal(numPlayers.toString(), "0")
                              assert.equal(recentWinner.toString(), accounts[0].address)
                              assert(endingTimeStamp > startingTimeStamp)
                              await expect(raffle.getPlayers(0)).to.be.reverted
                              resolve()
                          } catch (error) {
                              reject(e)
                          }
                      })

                      // inside the promise, means code wont complete until listener is finisdhed listening
                      // entering raffle
                      console.log("Entering Raffle...")
                      console.log(raffle.address)
                      const tx = await raffle.EnterRaffle({ value: raffleEntranceFee })
                      await tx.wait(1)
                      console.log("OK time to wait...")
                      const winnerStartingBalance = await accounts[0].getBalance() // deployer is accounts[0]
                  }) // end of Promise and Listener
              })
          }) // end of "fulfillRandomWords" test
      }) // end of the ENTIRE contract test
