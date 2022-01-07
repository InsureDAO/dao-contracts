//Market contracts
const USDCAddress = "0xa1D3c75Fe197D1d07Ce50E2489ee611F6248d397";
const OwnershipAddress = "0x00B6813DBD6a1407Cd8633002b6F1841c5a3aA51";
const RegistryAddress = "0x9Af1220b64832033167d81Eab8100732c531c465";
const FactoryAddress = "0xF9D37714b03de26aFF67f1F1774150F71D78d494";
const PremiumModelAddress = "0x215e373cb8Ade09C0c73416AA31DfE75bf698Aa0";
const ParametersAddress = "0xc6fd416D05e72c07fbaECeeF4e9d8AA0E7200481";
const VaultAddress = "0xCd37905637a8B86808113DEF8b90e8b9AE844613";

const PoolTemplateAddress = "0x43F0Ba06026EF8e573B7e27cBBc3addF439E0622";
const CDSTemplateAddress = "0x37fA8Bef894799DdB2C25be94541a2dc19F2c693";
const IndexTemplateAddress = "0x55e5Faefa43CA3386Dc8FAE26385E57756e02713";

const pools = [
  {
    
  }
]
const Market1 = "0x6A5Fe3d20e89F8d1C4C23C532dF35975dA444A55";
const Market2 = "0x3e5734497F097368B033eEE91Fe92C8d2ea56539";
const Market3 = "0xaFE0DC7C5b9c51977BC07899daAFa3551a40e58E";
const CDS = "0x2F398c37429D4b3F2cB4b11F49DC6877162f82A7";
const Index = "0x9516335DD0c069e3560a88e0eBE0a14a9937f136";


//DAO contracts
const LiquidityGauges = {
  //market: gauge
  '0x6A5Fe3d20e89F8d1C4C23C532dF35975dA444A55': '0x6A5Fe3d20e89F8d1C4C23C532dF35975dA444A55',
  '0x3e5734497F097368B033eEE91Fe92C8d2ea56539': '0xA66d44671bAC78f048d7dec20551129dBcF0E508',
  '0xaFE0DC7C5b9c51977BC07899daAFa3551a40e58E': '0x58d4d69f9613c715Ba2fbEafF9594a92D4348B4f',
  '0x9516335DD0c069e3560a88e0eBE0a14a9937f136': '0x758c6D74596037e5703f9e01472c551bA3D166bb',
  '0x2F398c37429D4b3F2cB4b11F49DC6877162f82A7': '0x10aB030Ce8d699ba783D1D1552A27D4A76eF7FDb',
}

const InsureToken = "0x487c50262110F5ccc0186e484348D0F5019a55f7"
const VotingEscrow = "0x56Ddd624CfBde63221216a1F78BA095B8C5e971c"
const GaugeController = "0xE727AEcb1a6d1E530Bb5BF9EE930e27C9C501fEc"
const Minter = "0xA880cfFaD3Bf06ce90898D01C1640bDb044C7E23"
const PoolProxy = "0x4B835F139AC523fD8e1d48B0A3437c45Edd528fC"




Object.assign(exports, {
  USDCAddress,
  OwnershipAddress,
  RegistryAddress,
  FactoryAddress,
  PremiumModelAddress,
  ParametersAddress,
  VaultAddress,
  PoolTemplateAddress,
  CDSTemplateAddress,
  IndexTemplateAddress,
  Market1,
  Market2,
  Market3,
  CDS,
  Index,
})