import { getTestSelector } from '../../utils'
import { DISCONNECTED_WALLET_USER_STATE } from '../../utils/user-state'

describe('disconnect wallet', () => {
  it('should not clear state', () => {
    cy.visit('/swap', { ethereum: 'hardhat' })
    cy.get('#swap-currency-input .token-amount-input').clear().type('1')

    // Verify wallet is connected
    cy.hardhat().then((hardhat) => cy.contains(hardhat.wallet.address.substring(0, 6)))
    cy.contains('Balance:')

    // Disconnect the wallet
    cy.hardhat().then((hardhat) => cy.contains(hardhat.wallet.address.substring(0, 6)).click())
    cy.get(getTestSelector('wallet-disconnect')).click()
    cy.get(getTestSelector('wallet-disconnect')).contains('Disconnect')
    cy.get(getTestSelector('wallet-disconnect')).click()

    // Verify wallet has disconnected
    cy.contains('Connect a wallet').should('exist')
    cy.get(getTestSelector('navbar-connect-wallet')).contains('Connect')
    cy.contains('Connect Wallet')

    // Verify swap input is cleared
    cy.get('#swap-currency-input .token-amount-input').should('have.value', '1')
  })
})

describe('connect wallet', () => {
  it('should load state', () => {
    cy.visit('/swap', { ethereum: 'hardhat', userState: DISCONNECTED_WALLET_USER_STATE })

    // Connect the wallet
    cy.get(getTestSelector('navbar-connect-wallet')).contains('Connect').click()
    cy.contains('MetaMask').click()

    // Verify wallet is connected
    cy.hardhat().then((hardhat) => cy.contains(hardhat.wallet.address.substring(0, 6)))
    cy.contains('Balance:')
  })
})
