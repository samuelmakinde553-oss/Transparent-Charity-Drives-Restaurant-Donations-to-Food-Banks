# 🍽️ Transparent Charity Drives: Restaurant Donations to Food Banks

This Web3 project leverages the Stacks blockchain and Clarity smart contracts to create a transparent, decentralized system for tracking restaurant food donations to food banks. It addresses the real-world problem of inefficient donation tracking, ensuring transparency, accountability, and trust between restaurants, food banks, and donors. Restaurants can register donations, food banks can verify receipt, and the public can track the flow of donations in real-time.

<xaiArtifact artifact_id="79191be8-b004-44bb-81c7-7e6df81eb4f7" artifact_version_id="54ca3d9f-c20f-45d8-87d7-0824c6a61100" title="README.md" contentType="text/markdown">

# 🍽️ Transparent Charity Drives: Restaurant Donations to Food Banks

Welcome to a decentralized solution for tracking restaurant food donations to food banks using the Stacks blockchain and Clarity smart contracts. This project ensures transparency, accountability, and trust in the donation process, solving inefficiencies in tracking and verifying food donations.

## ✨ Features

- 🍴 **Restaurant Donation Registration**: Restaurants register food donations with details like quantity and type.
- 🏦 **Food Bank Verification**: Food banks confirm receipt of donations, ensuring accountability.
- 📊 **Public Transparency**: Anyone can view donation records and verify their authenticity.
- 🔐 **Immutable Records**: Donations are timestamped and stored on the blockchain.
- 🛡️ **Duplicate Prevention**: Ensures donations are not double-counted.
- 📈 **Analytics Dashboard**: Tracks total donations and impact metrics.
- 🔔 **Donation Alerts**: Notifies food banks of new donations.
- 🔄 **Dispute Resolution**: Handles discrepancies between restaurants and food banks.

## 🛠 How It Works

### For Restaurants
1. Register a donation by calling `register-donation` with:
   - Donation ID (unique hash)
   - Food type (e.g., "perishable", "non-perishable")
   - Quantity (in kg or units)
   - Timestamp
2. The donation is recorded immutably on the blockchain.

### For Food Banks
1. Verify receipt of a donation using `verify-donation-receipt`.
2. Optionally, flag discrepancies via `raise-dispute`.

### For the Public
1. Use `get-donation-details` to view donation records.
2. Access `get-total-donations` for aggregate impact metrics.

### Usage
- **Restaurants**: Use the `register-donation` function in `DonationRegistry.clar` to log a donation.
- **Food Banks**: Call `verify-donation-receipt` in `DonationVerification.clar` to confirm receipt.
- **Public**: Query `get-donation-details` or `get-total-donations` in `Analytics.clar` for transparency.

