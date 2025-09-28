// Auto-generated contract addresses
// Generated at: 2025-09-28T11:35:35.131Z

export const CONTRACT_ADDRESSES = {
  PrivacyLottery: "0x5FF83dD7122ca2459D7BB4b0C7f2Ea654D9dF84e",
};

export const NETWORK_CONFIG = {
  name: "Sepolia",
  chainId: 11155111,
  rpcUrl: "https://sepolia.infura.io/v3/YOUR_INFURA_KEY",
};

// Privacy Lottery ABI
export const PRIVACY_LOTTERY_ABI = [
  "function createLottery(string memory name, string memory description, uint256 ticketPrice, uint256 maxTickets, uint256 prizeAmount, uint256 duration) external returns (uint256)",
  "function purchaseTickets(uint256 lotteryId, uint256 ticketCount) external payable",
  "function drawWinners(uint256 lotteryId) external",
  "function claimPrize(uint256 lotteryId) external",
  "function getLotteryInfo(uint256 lotteryId) external view returns (string memory, string memory, uint256, uint256, uint256, uint256, uint256, bool, bool, uint256, uint256)",
  "function getParticipantTickets(uint256 lotteryId, address participant) external view returns (uint256)",
  "function getParticipants(uint256 lotteryId) external view returns (address[] memory)",
  "function getWinners(uint256 lotteryId) external view returns (address[] memory)",
  "function getLotteryCount() external view returns (uint256)",
  "function lotteries(uint256) external view returns (uint256, string memory, string memory, uint256, uint256, uint256, uint256, uint256, address, bool, bool)",
  "event LotteryCreated(uint256 indexed lotteryId, string name, uint256 ticketPrice, uint256 maxTickets)",
  "event TicketPurchased(uint256 indexed lotteryId, address indexed participant, uint256 ticketCount)",
  "event LotteryDrawn(uint256 indexed lotteryId, address[] winners)",
  "event PrizeClaimed(uint256 indexed lotteryId, address indexed winner, uint256 amount)"
];
