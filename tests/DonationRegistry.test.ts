import { describe, it, expect, beforeEach } from "vitest";
import { stringAsciiCV, uintCV, buffCV, optionalCV, principalCV } from "@stacks/transactions";

const ERR_NOT_AUTHORIZED = 100;
const ERR_INVALID_DONATION_ID = 101;
const ERR_INVALID_FOOD_TYPE = 102;
const ERR_INVALID_QUANTITY = 103;
const ERR_INVALID_TIMESTAMP = 104;
const ERR_DONATION_ALREADY_EXISTS = 105;
const ERR_DONATION_NOT_FOUND = 106;
const ERR_INVALID_STATUS = 107;
const ERR_INVALID_DESCRIPTION = 108;
const ERR_INVALID_LOCATION = 109;
const ERR_INVALID_CURRENCY = 110;
const ERR_INVALID_UPDATE_PARAM = 111;
const ERR_MAX_DONATIONS_EXCEEDED = 112;
const ERR_AUTHORITY_NOT_VERIFIED = 113;
const ERR_INVALID_EXPIRY = 114;
const ERR_INVALID_RECIPIENT = 115;
const ERR_UPDATE_NOT_ALLOWED = 116;

interface Donation {
  donationId: Uint8Array;
  restaurant: string;
  foodType: string;
  quantity: number;
  timestamp: number;
  status: boolean;
  description: string;
  location: string;
  currency: string;
  expiry: number;
  recipient: string | null;
}

interface DonationUpdate {
  updateFoodType: string;
  updateQuantity: number;
  updateTimestamp: number;
  updater: string;
}

interface Result<T> {
  ok: boolean;
  value: T;
}

class DonationRegistryMock {
  state: {
    nextDonationId: number;
    maxDonations: number;
    registrationFee: number;
    authorityContract: string | null;
    donations: Map<number, Donation>;
    donationUpdates: Map<number, DonationUpdate>;
    donationsByHash: Map<string, number>;
  } = {
    nextDonationId: 0,
    maxDonations: 10000,
    registrationFee: 500,
    authorityContract: null,
    donations: new Map(),
    donationUpdates: new Map(),
    donationsByHash: new Map(),
  };
  blockHeight: number = 0;
  caller: string = "ST1TEST";
  authorities: Set<string> = new Set(["ST1TEST"]);
  stxTransfers: Array<{ amount: number; from: string; to: string | null }> = [];

  constructor() {
    this.reset();
  }

  reset() {
    this.state = {
      nextDonationId: 0,
      maxDonations: 10000,
      registrationFee: 500,
      authorityContract: null,
      donations: new Map(),
      donationUpdates: new Map(),
      donationsByHash: new Map(),
    };
    this.blockHeight = 0;
    this.caller = "ST1TEST";
    this.authorities = new Set(["ST1TEST"]);
    this.stxTransfers = [];
  }

  setAuthorityContract(contractPrincipal: string): Result<boolean> {
    if (contractPrincipal === "SP000000000000000000002Q6VF78") {
      return { ok: false, value: false };
    }
    if (this.state.authorityContract !== null) {
      return { ok: false, value: false };
    }
    this.state.authorityContract = contractPrincipal;
    return { ok: true, value: true };
  }

  setRegistrationFee(newFee: number): Result<boolean> {
    if (!this.state.authorityContract) return { ok: false, value: false };
    this.state.registrationFee = newFee;
    return { ok: true, value: true };
  }

  setMaxDonations(newMax: number): Result<boolean> {
    if (!this.state.authorityContract) return { ok: false, value: false };
    if (newMax <= 0) return { ok: false, value: false };
    this.state.maxDonations = newMax;
    return { ok: true, value: true };
  }

  registerDonation(
    donationHash: Uint8Array,
    foodType: string,
    quantity: number,
    description: string,
    location: string,
    currency: string,
    expiry: number,
    recipient: string | null
  ): Result<number> {
    if (this.state.nextDonationId >= this.state.maxDonations) return { ok: false, value: ERR_MAX_DONATIONS_EXCEEDED };
    if (donationHash.length === 0) return { ok: false, value: ERR_INVALID_DONATION_ID };
    if (foodType.length === 0 || foodType.length > 50) return { ok: false, value: ERR_INVALID_FOOD_TYPE };
    if (quantity <= 0) return { ok: false, value: ERR_INVALID_QUANTITY };
    if (description.length > 200) return { ok: false, value: ERR_INVALID_DESCRIPTION };
    if (location.length === 0 || location.length > 100) return { ok: false, value: ERR_INVALID_LOCATION };
    if (!["STX", "USD", "BTC"].includes(currency)) return { ok: false, value: ERR_INVALID_CURRENCY };
    if (expiry <= this.blockHeight) return { ok: false, value: ERR_INVALID_EXPIRY };
    const hashKey = donationHash.toString();
    if (this.state.donationsByHash.has(hashKey)) return { ok: false, value: ERR_DONATION_ALREADY_EXISTS };
    if (!this.state.authorityContract) return { ok: false, value: ERR_AUTHORITY_NOT_VERIFIED };

    this.stxTransfers.push({ amount: this.state.registrationFee, from: this.caller, to: this.state.authorityContract });

    const id = this.state.nextDonationId;
    const donation: Donation = {
      donationId: donationHash,
      restaurant: this.caller,
      foodType,
      quantity,
      timestamp: this.blockHeight,
      status: true,
      description,
      location,
      currency,
      expiry,
      recipient,
    };
    this.state.donations.set(id, donation);
    this.state.donationsByHash.set(hashKey, id);
    this.state.nextDonationId++;
    return { ok: true, value: id };
  }

  getDonation(id: number): Donation | null {
    return this.state.donations.get(id) || null;
  }

  updateDonation(id: number, updateFoodType: string, updateQuantity: number): Result<boolean> {
    const donation = this.state.donations.get(id);
    if (!donation) return { ok: false, value: false };
    if (donation.restaurant !== this.caller) return { ok: false, value: false };
    if (updateFoodType.length === 0 || updateFoodType.length > 50) return { ok: false, value: false };
    if (updateQuantity <= 0) return { ok: false, value: false };

    const updated: Donation = {
      ...donation,
      foodType: updateFoodType,
      quantity: updateQuantity,
      timestamp: this.blockHeight,
    };
    this.state.donations.set(id, updated);
    this.state.donationUpdates.set(id, {
      updateFoodType,
      updateQuantity,
      updateTimestamp: this.blockHeight,
      updater: this.caller,
    });
    return { ok: true, value: true };
  }

  setDonationStatus(id: number, newStatus: boolean): Result<boolean> {
    const donation = this.state.donations.get(id);
    if (!donation) return { ok: false, value: false };
    if (donation.restaurant !== this.caller) return { ok: false, value: false };
    const updated: Donation = { ...donation, status: newStatus };
    this.state.donations.set(id, updated);
    return { ok: true, value: true };
  }

  assignRecipient(id: number, newRecipient: string): Result<boolean> {
    const donation = this.state.donations.get(id);
    if (!donation) return { ok: false, value: false };
    if (donation.restaurant !== this.caller) return { ok: false, value: false };
    if (newRecipient === "SP000000000000000000002Q6VF78") return { ok: false, value: false };
    const updated: Donation = { ...donation, recipient: newRecipient };
    this.state.donations.set(id, updated);
    return { ok: true, value: true };
  }

  getDonationCount(): Result<number> {
    return { ok: true, value: this.state.nextDonationId };
  }

  checkDonationExistence(hash: Uint8Array): Result<boolean> {
    return { ok: true, value: this.state.donationsByHash.has(hash.toString()) };
  }
}

describe("DonationRegistry", () => {
  let contract: DonationRegistryMock;

  beforeEach(() => {
    contract = new DonationRegistryMock();
    contract.reset();
  });

  it("registers a donation successfully", () => {
    contract.setAuthorityContract("ST2TEST");
    const hash = new Uint8Array([1, 2, 3]);
    const result = contract.registerDonation(
      hash,
      "perishable",
      100,
      "Fresh veggies",
      "CityZ",
      "STX",
      1000,
      null
    );
    expect(result.ok).toBe(true);
    expect(result.value).toBe(0);

    const donation = contract.getDonation(0);
    expect(donation?.foodType).toBe("perishable");
    expect(donation?.quantity).toBe(100);
    expect(donation?.description).toBe("Fresh veggies");
    expect(donation?.location).toBe("CityZ");
    expect(donation?.currency).toBe("STX");
    expect(donation?.expiry).toBe(1000);
    expect(contract.stxTransfers).toEqual([{ amount: 500, from: "ST1TEST", to: "ST2TEST" }]);
  });

  it("rejects duplicate donation hashes", () => {
    contract.setAuthorityContract("ST2TEST");
    const hash = new Uint8Array([1, 2, 3]);
    contract.registerDonation(
      hash,
      "perishable",
      100,
      "Fresh veggies",
      "CityZ",
      "STX",
      1000,
      null
    );
    const result = contract.registerDonation(
      hash,
      "non-perishable",
      200,
      "Canned goods",
      "TownA",
      "USD",
      2000,
      "ST3RECIP"
    );
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_DONATION_ALREADY_EXISTS);
  });

  it("rejects registration without authority contract", () => {
    const hash = new Uint8Array([1, 2, 3]);
    const result = contract.registerDonation(
      hash,
      "perishable",
      100,
      "Fresh veggies",
      "CityZ",
      "STX",
      1000,
      null
    );
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_AUTHORITY_NOT_VERIFIED);
  });

  it("rejects invalid food type", () => {
    contract.setAuthorityContract("ST2TEST");
    const hash = new Uint8Array([1, 2, 3]);
    const result = contract.registerDonation(
      hash,
      "",
      100,
      "Fresh veggies",
      "CityZ",
      "STX",
      1000,
      null
    );
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_INVALID_FOOD_TYPE);
  });

  it("rejects invalid quantity", () => {
    contract.setAuthorityContract("ST2TEST");
    const hash = new Uint8Array([1, 2, 3]);
    const result = contract.registerDonation(
      hash,
      "perishable",
      0,
      "Fresh veggies",
      "CityZ",
      "STX",
      1000,
      null
    );
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_INVALID_QUANTITY);
  });

  it("rejects invalid currency", () => {
    contract.setAuthorityContract("ST2TEST");
    const hash = new Uint8Array([1, 2, 3]);
    const result = contract.registerDonation(
      hash,
      "perishable",
      100,
      "Fresh veggies",
      "CityZ",
      "EUR",
      1000,
      null
    );
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_INVALID_CURRENCY);
  });

  it("updates a donation successfully", () => {
    contract.setAuthorityContract("ST2TEST");
    const hash = new Uint8Array([1, 2, 3]);
    contract.registerDonation(
      hash,
      "perishable",
      100,
      "Fresh veggies",
      "CityZ",
      "STX",
      1000,
      null
    );
    const result = contract.updateDonation(0, "non-perishable", 200);
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    const donation = contract.getDonation(0);
    expect(donation?.foodType).toBe("non-perishable");
    expect(donation?.quantity).toBe(200);
    const update = contract.state.donationUpdates.get(0);
    expect(update?.updateFoodType).toBe("non-perishable");
    expect(update?.updateQuantity).toBe(200);
    expect(update?.updater).toBe("ST1TEST");
  });

  it("rejects update for non-existent donation", () => {
    contract.setAuthorityContract("ST2TEST");
    const result = contract.updateDonation(99, "non-perishable", 200);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(false);
  });

  it("rejects update by non-restaurant", () => {
    contract.setAuthorityContract("ST2TEST");
    const hash = new Uint8Array([1, 2, 3]);
    contract.registerDonation(
      hash,
      "perishable",
      100,
      "Fresh veggies",
      "CityZ",
      "STX",
      1000,
      null
    );
    contract.caller = "ST3FAKE";
    const result = contract.updateDonation(0, "non-perishable", 200);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(false);
  });

  it("sets registration fee successfully", () => {
    contract.setAuthorityContract("ST2TEST");
    const result = contract.setRegistrationFee(1000);
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    expect(contract.state.registrationFee).toBe(1000);
    const hash = new Uint8Array([1, 2, 3]);
    contract.registerDonation(
      hash,
      "perishable",
      100,
      "Fresh veggies",
      "CityZ",
      "STX",
      1000,
      null
    );
    expect(contract.stxTransfers).toEqual([{ amount: 1000, from: "ST1TEST", to: "ST2TEST" }]);
  });

  it("rejects registration fee change without authority", () => {
    const result = contract.setRegistrationFee(1000);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(false);
  });

  it("returns correct donation count", () => {
    contract.setAuthorityContract("ST2TEST");
    const hash1 = new Uint8Array([1, 2, 3]);
    contract.registerDonation(
      hash1,
      "perishable",
      100,
      "Fresh veggies",
      "CityZ",
      "STX",
      1000,
      null
    );
    const hash2 = new Uint8Array([4, 5, 6]);
    contract.registerDonation(
      hash2,
      "non-perishable",
      200,
      "Canned goods",
      "TownA",
      "USD",
      2000,
      "ST3RECIP"
    );
    const result = contract.getDonationCount();
    expect(result.ok).toBe(true);
    expect(result.value).toBe(2);
  });

  it("checks donation existence correctly", () => {
    contract.setAuthorityContract("ST2TEST");
    const hash = new Uint8Array([1, 2, 3]);
    contract.registerDonation(
      hash,
      "perishable",
      100,
      "Fresh veggies",
      "CityZ",
      "STX",
      1000,
      null
    );
    const result = contract.checkDonationExistence(hash);
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    const fakeHash = new Uint8Array([7, 8, 9]);
    const result2 = contract.checkDonationExistence(fakeHash);
    expect(result2.ok).toBe(true);
    expect(result2.value).toBe(false);
  });

  it("sets donation status successfully", () => {
    contract.setAuthorityContract("ST2TEST");
    const hash = new Uint8Array([1, 2, 3]);
    contract.registerDonation(
      hash,
      "perishable",
      100,
      "Fresh veggies",
      "CityZ",
      "STX",
      1000,
      null
    );
    const result = contract.setDonationStatus(0, false);
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    const donation = contract.getDonation(0);
    expect(donation?.status).toBe(false);
  });

  it("assigns recipient successfully", () => {
    contract.setAuthorityContract("ST2TEST");
    const hash = new Uint8Array([1, 2, 3]);
    contract.registerDonation(
      hash,
      "perishable",
      100,
      "Fresh veggies",
      "CityZ",
      "STX",
      1000,
      null
    );
    const result = contract.assignRecipient(0, "ST4BANK");
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    const donation = contract.getDonation(0);
    expect(donation?.recipient).toBe("ST4BANK");
  });

  it("rejects max donations exceeded", () => {
    contract.setAuthorityContract("ST2TEST");
    contract.setMaxDonations(1);
    const hash1 = new Uint8Array([1, 2, 3]);
    contract.registerDonation(
      hash1,
      "perishable",
      100,
      "Fresh veggies",
      "CityZ",
      "STX",
      1000,
      null
    );
    const hash2 = new Uint8Array([4, 5, 6]);
    const result = contract.registerDonation(
      hash2,
      "non-perishable",
      200,
      "Canned goods",
      "TownA",
      "USD",
      2000,
      "ST3RECIP"
    );
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_MAX_DONATIONS_EXCEEDED);
  });

  it("sets authority contract successfully", () => {
    const result = contract.setAuthorityContract("ST2TEST");
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    expect(contract.state.authorityContract).toBe("ST2TEST");
  });

  it("rejects invalid authority contract", () => {
    const result = contract.setAuthorityContract("SP000000000000000000002Q6VF78");
    expect(result.ok).toBe(false);
    expect(result.value).toBe(false);
  });
});