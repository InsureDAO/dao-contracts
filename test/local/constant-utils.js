const { ethers } = require("hardhat");
const { BigNumber } = require("ethers");

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
const NULL_ADDRESS = "0xffffffffffffffffffffffffffffffffffffffff";
const TEST_ADDRESS = "0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B";

const YEAR = BigNumber.from("86400").mul(365);
const WEEK = BigNumber.from("86400").mul(7);
const DAY = BigNumber.from("86400");

const ten_to_the_18 = BigNumber.from("1000000000000000000");
const ten_to_the_6 = BigNumber.from("1000000");
const ten_to_the_5 = BigNumber.from("100000");

const ZERO = ethers.BigNumber.from("0");
const ONE = ethers.BigNumber.from("1");
const TWO = ethers.BigNumber.from("2");

const INFLATION_DELAY = 86400;

Object.assign(exports, {
  ZERO_ADDRESS,
  NULL_ADDRESS,
  TEST_ADDRESS,
  INFLATION_DELAY,
  YEAR,
  WEEK,
  DAY,
  ten_to_the_18,
  ten_to_the_6,
  ten_to_the_5,
  ZERO,
  ONE,
  TWO,
});
