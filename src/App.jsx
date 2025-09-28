import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { CONTRACT_ADDRESSES, PRIVACY_LOTTERY_ABI } from './config/contracts';
import fheClient from './fheClient';
import './index.css';

function App() {
  // State management
  const [account, setAccount] = useState(null);
  const [provider, setProvider] = useState(null);
  const [contract, setContract] = useState(null);
  const [lotteries, setLotteries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [fheInitialized, setFheInitialized] = useState(false);

  // Lottery creation form state
  const [createForm, setCreateForm] = useState({
    name: '',
    description: '',
    ticketPrice: '',
    maxTickets: '',
    prizeAmount: '',
    duration: ''
  });

  // Lottery participation form state
  const [participateForm, setParticipateForm] = useState({
    lotteryId: '',
    ticketCount: ''
  });

  // Initialize application
  useEffect(() => {
    initializeApp();
  }, []);

  // Initialize FHEVM client
  useEffect(() => {
    initializeFHE();
  }, []);

  // Initialize application
  const initializeApp = async () => {
    try {
      // Check if MetaMask is installed
      if (typeof window.ethereum !== 'undefined') {
        const provider = new ethers.BrowserProvider(window.ethereum);
        setProvider(provider);
        
        // Get connected accounts
        const accounts = await provider.listAccounts();
        if (accounts.length > 0) {
          setAccount(accounts[0].address);
          initializeContract(provider, accounts[0]);
        }
      } else {
        setError('Please install MetaMask wallet');
      }
    } catch (error) {
      console.error('Initialization failed:', error);
      setError('Initialization failed: ' + error.message);
    }
  };

  // Initialize FHEVM client
  const initializeFHE = async () => {
    try {
      const success = await fheClient.initialize();
      setFheInitialized(success);
      if (success) {
        console.log('FHEVM client initialized successfully');
      }
    } catch (error) {
      console.error('FHEVM initialization failed:', error);
      setError('FHEVM initialization failed: ' + error.message);
    }
  };

  // Initialize contract
  const initializeContract = async (provider, signer) => {
    try {
      const contract = new ethers.Contract(
        CONTRACT_ADDRESSES.PrivacyLottery,
        PRIVACY_LOTTERY_ABI,
        signer
      );
      setContract(contract);
      await loadLotteries(contract);
    } catch (error) {
      console.error('Contract initialization failed:', error);
      setError('Contract initialization failed: ' + error.message);
    }
  };

  // Connect wallet
  const connectWallet = async () => {
    try {
      setLoading(true);
      setError(null);

      if (typeof window.ethereum !== 'undefined') {
        const accounts = await window.ethereum.request({
          method: 'eth_requestAccounts'
        });
        
        const provider = new ethers.BrowserProvider(window.ethereum);
        const signer = await provider.getSigner();
        
        setAccount(accounts[0]);
        setProvider(provider);
        await initializeContract(provider, signer);
        
        console.log('Wallet connected successfully:', accounts[0]);
      } else {
        setError('Please install MetaMask wallet');
      }
    } catch (error) {
      console.error('Wallet connection failed:', error);
      setError('Wallet connection failed: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Load lottery list
  const loadLotteries = async (contractInstance) => {
    try {
      if (!contractInstance) return;

      const lotteryCount = await contractInstance.getLotteryCount();
      const lotteryList = [];

      for (let i = 0; i < Number(lotteryCount); i++) {
        try {
          const lotteryInfo = await contractInstance.getLotteryInfo(i);
          const participants = await contractInstance.getParticipants(i);
          const winners = await contractInstance.getWinners(i);

          lotteryList.push({
            id: i,
            name: lotteryInfo[0],
            description: lotteryInfo[1],
            ticketPrice: lotteryInfo[2].toString(),
            maxTickets: lotteryInfo[3].toString(),
            prizeAmount: lotteryInfo[4].toString(),
            startTime: Number(lotteryInfo[5]),
            endTime: Number(lotteryInfo[6]),
            isActive: lotteryInfo[7],
            isDrawn: lotteryInfo[8],
            participantCount: Number(lotteryInfo[9]),
            winnerCount: Number(lotteryInfo[10]),
            participants: participants,
            winners: winners
          });
        } catch (error) {
          console.error(`Failed to load lottery ${i}:`, error);
        }
      }

      setLotteries(lotteryList);
    } catch (error) {
      console.error('Failed to load lottery list:', error);
      setError('Failed to load lottery list: ' + error.message);
    }
  };

  // Create lottery
  const createLottery = async (e) => {
    e.preventDefault();
    if (!contract) {
      setError('Please connect wallet first');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const ticketPrice = ethers.parseEther(createForm.ticketPrice);
      const prizeAmount = ethers.parseEther(createForm.prizeAmount);
      const duration = Number(createForm.duration) * 24 * 60 * 60; // Convert to seconds

      const tx = await contract.createLottery(
        createForm.name,
        createForm.description,
        ticketPrice,
        createForm.maxTickets,
        prizeAmount,
        duration
      );

      await tx.wait();
      console.log('Lottery created successfully');

      // Reset form
      setCreateForm({
        name: '',
        description: '',
        ticketPrice: '',
        maxTickets: '',
        prizeAmount: '',
        duration: ''
      });

      // Reload lottery list
      await loadLotteries(contract);
    } catch (error) {
      console.error('Failed to create lottery:', error);
      setError('Failed to create lottery: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Participate in lottery
  const participateInLottery = async (e) => {
    e.preventDefault();
    if (!contract) {
      setError('Please connect wallet first');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const lotteryId = Number(participateForm.lotteryId);
      const ticketCount = Number(participateForm.ticketCount);
      const lottery = lotteries[lotteryId];

      if (!lottery) {
        setError('Lottery does not exist');
        return;
      }

      // Calculate total cost: single price * quantity
      // Ensure proper handling of BigInt types and scientific notation
      const ticketPriceWei = typeof lottery.ticketPrice === 'string' 
        ? lottery.ticketPrice 
        : lottery.ticketPrice.toString();
      const ticketPriceInEth = parseFloat(ethers.formatEther(ticketPriceWei));
      const totalCostInEth = ticketPriceInEth * ticketCount;
      
      // Convert scientific notation to fixed decimal format
      const totalCostStr = totalCostInEth.toFixed(18);
      const totalCost = ethers.parseEther(totalCostStr);
      
      // Debug information
      console.log('Lottery info:', {
        ticketPrice: lottery.ticketPrice,
        ticketPriceInEth,
        ticketCount,
        totalCostInEth,
        totalCostStr,
        totalCost: totalCost.toString()
      });
      
      // Check balance
      const balance = await provider.getBalance(account);
      console.log('Current balance:', ethers.formatEther(balance), 'ETH');
      console.log('Required amount:', ethers.formatEther(totalCost), 'ETH');
      
      // Compare BigInt types
      if (balance < totalCost) {
        setError(`Insufficient balance! Current balance: ${ethers.formatEther(balance)} ETH, required: ${ethers.formatEther(totalCost)} ETH`);
        return;
      }

      const tx = await contract.purchaseTickets(lotteryId, ticketCount, {
        value: totalCost
      });

      await tx.wait();
      console.log('Lottery participation successful');

      // Reset form
      setParticipateForm({
        lotteryId: '',
        ticketCount: ''
      });

      // Reload lottery list
      await loadLotteries(contract);
    } catch (error) {
      console.error('Failed to participate in lottery:', error);
      setError('Failed to participate in lottery: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Draw winners
  const drawWinners = async (lotteryId) => {
    if (!contract) {
      setError('Please connect wallet first');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const tx = await contract.drawWinners(lotteryId);
      await tx.wait();
      console.log('Winners drawn successfully');

      // Reload lottery list
      await loadLotteries(contract);
    } catch (error) {
      console.error('Failed to draw winners:', error);
      setError('Failed to draw winners: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Claim prize
  const claimPrize = async (lotteryId) => {
    if (!contract) {
      setError('Please connect wallet first');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const tx = await contract.claimPrize(lotteryId);
      await tx.wait();
      console.log('Prize claimed successfully');

      // Reload lottery list
      await loadLotteries(contract);
    } catch (error) {
      console.error('Failed to claim prize:', error);
      setError('Failed to claim prize: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Format time
  const formatTime = (timestamp) => {
    return new Date(timestamp * 1000).toLocaleString('zh-CN');
  };

  // Format ether
  const formatEther = (wei) => {
    return ethers.formatEther(wei);
  };

  // Get lottery status
  const getLotteryStatus = (lottery) => {
    const now = Math.floor(Date.now() / 1000);
    if (!lottery.isActive) return 'Ended';
    if (now < lottery.startTime) return 'Not Started';
    if (now > lottery.endTime) return 'Ended';
    return 'In Progress';
  };

  // Get status style
  const getStatusStyle = (status) => {
    switch (status) {
      case 'In Progress':
        return 'status-active';
      case 'Not Started':
        return 'status-pending';
      case 'Ended':
        return 'status-ended';
      default:
        return 'status-pending';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900">
      {/* Header */}
      <header className="glass border-b border-white/20 p-6">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full flex items-center justify-center">
              <span className="text-white font-bold text-xl">🎲</span>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">FHEVM Privacy Lottery</h1>
              <p className="text-gray-300">Privacy-preserving lottery system based on fully homomorphic encryption</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-4">
            {fheInitialized && (
              <div className="flex items-center space-x-2 text-green-400">
                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                <span className="text-sm">FHEVM Connected</span>
              </div>
            )}
            
            {account ? (
              <div className="flex items-center space-x-3">
                <div className="text-white">
                  <div className="text-sm text-gray-300">Connected</div>
                  <div className="font-mono text-sm">{account.slice(0, 6)}...{account.slice(-4)}</div>
                </div>
                <button
                  onClick={() => setAccount(null)}
                  className="px-4 py-2 bg-red-500/20 text-red-400 border border-red-500/30 rounded-lg hover:bg-red-500/30 transition-colors"
                >
                  Disconnect
                </button>
              </div>
            ) : (
              <button
                onClick={connectWallet}
                disabled={loading}
                className="btn-gradient px-6 py-3 rounded-lg text-white font-medium hover:shadow-lg transition-all disabled:opacity-50"
              >
                {loading ? 'Connecting...' : 'Connect Wallet'}
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-7xl mx-auto p-6">
        {/* Error message */}
        {error && (
          <div className="mb-6 p-4 bg-red-500/20 border border-red-500/30 rounded-lg text-red-400">
            {error}
          </div>
        )}

        {/* Create lottery form */}
        {account && (
          <div className="mb-8">
            <div className="glass rounded-xl p-6">
              <h2 className="text-xl font-bold text-white mb-4">Create New Lottery</h2>
              <form onSubmit={createLottery} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Lottery Name</label>
                  <input
                    type="text"
                    value={createForm.name}
                    onChange={(e) => setCreateForm({...createForm, name: e.target.value})}
                    className="input-glass w-full px-4 py-2 rounded-lg text-white placeholder-gray-400"
                    placeholder="Enter lottery name"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Description</label>
                  <input
                    type="text"
                    value={createForm.description}
                    onChange={(e) => setCreateForm({...createForm, description: e.target.value})}
                    className="input-glass w-full px-4 py-2 rounded-lg text-white placeholder-gray-400"
                    placeholder="Enter lottery description"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Single Ticket Price (ETH)</label>
                  <input
                    type="number"
                    step="0.001"
                    value={createForm.ticketPrice}
                    onChange={(e) => setCreateForm({...createForm, ticketPrice: e.target.value})}
                    className="input-glass w-full px-4 py-2 rounded-lg text-white placeholder-gray-400"
                    placeholder="0.01"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Max Tickets</label>
                  <input
                    type="number"
                    value={createForm.maxTickets}
                    onChange={(e) => setCreateForm({...createForm, maxTickets: e.target.value})}
                    className="input-glass w-full px-4 py-2 rounded-lg text-white placeholder-gray-400"
                    placeholder="100"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Total Prize Amount (ETH)</label>
                  <input
                    type="number"
                    step="0.001"
                    value={createForm.prizeAmount}
                    onChange={(e) => setCreateForm({...createForm, prizeAmount: e.target.value})}
                    className="input-glass w-full px-4 py-2 rounded-lg text-white placeholder-gray-400"
                    placeholder="1.0"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Duration (Days)</label>
                  <input
                    type="number"
                    value={createForm.duration}
                    onChange={(e) => setCreateForm({...createForm, duration: e.target.value})}
                    className="input-glass w-full px-4 py-2 rounded-lg text-white placeholder-gray-400"
                    placeholder="7"
                    required
                  />
                </div>
                
                <div className="md:col-span-2 lg:col-span-3">
                  <button
                    type="submit"
                    disabled={loading}
                    className="btn-gradient px-6 py-3 rounded-lg text-white font-medium hover:shadow-lg transition-all disabled:opacity-50"
                  >
                    {loading ? 'Creating...' : 'Create Lottery'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Participate in lottery form */}
        {account && (
          <div className="mb-8">
            <div className="glass rounded-xl p-6">
              <h2 className="text-xl font-bold text-white mb-4">Participate in Lottery</h2>
              <form onSubmit={participateInLottery} className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Lottery ID</label>
                  <input
                    type="number"
                    value={participateForm.lotteryId}
                    onChange={(e) => setParticipateForm({...participateForm, lotteryId: e.target.value})}
                    className="input-glass w-full px-4 py-2 rounded-lg text-white placeholder-gray-400"
                    placeholder="0"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Ticket Count</label>
                  <input
                    type="number"
                    value={participateForm.ticketCount}
                    onChange={(e) => setParticipateForm({...participateForm, ticketCount: e.target.value})}
                    className="input-glass w-full px-4 py-2 rounded-lg text-white placeholder-gray-400"
                    placeholder="1"
                    required
                  />
                </div>
                
                <div className="flex items-end">
                  <button
                    type="submit"
                    disabled={loading}
                    className="btn-gradient px-6 py-2 rounded-lg text-white font-medium hover:shadow-lg transition-all disabled:opacity-50 w-full"
                  >
                    {loading ? 'Participating...' : 'Participate in Lottery'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Lottery list */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-white mb-6">Lottery List</h2>
          <div className="grid-responsive">
            {lotteries.map((lottery) => (
              <div key={lottery.id} className="glass rounded-xl p-6 card-hover">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-xl font-bold text-white mb-2">{lottery.name}</h3>
                    <p className="text-gray-300 text-sm mb-2">{lottery.description}</p>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusStyle(getLotteryStatus(lottery))}`}>
                    {getLotteryStatus(lottery)}
                  </span>
                </div>
                
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <div className="text-sm text-gray-400">Single Price</div>
                    <div className="text-white font-medium">{formatEther(lottery.ticketPrice)} ETH</div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-400">Total Prize</div>
                    <div className="text-white font-medium">{formatEther(lottery.prizeAmount)} ETH</div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-400">Participants</div>
                    <div className="text-white font-medium">{lottery.participantCount}</div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-400">Max Tickets</div>
                    <div className="text-white font-medium">{lottery.maxTickets}</div>
                  </div>
                </div>
                
                <div className="mb-4">
                  <div className="text-sm text-gray-400 mb-1">Time Info</div>
                  <div className="text-white text-sm">
                    <div>Start: {formatTime(lottery.startTime)}</div>
                    <div>End: {formatTime(lottery.endTime)}</div>
                  </div>
                </div>
                
                {lottery.winners.length > 0 && (
                  <div className="mb-4">
                    <div className="text-sm text-gray-400 mb-1">Winners</div>
                    <div className="text-green-400 text-sm">
                      {lottery.winners.map((winner, index) => (
                        <div key={index} className="font-mono">
                          {winner.slice(0, 6)}...{winner.slice(-4)}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                <div className="flex flex-wrap gap-2">
                  {getLotteryStatus(lottery) === 'Ended' && !lottery.isDrawn && (
                    <button
                      onClick={() => drawWinners(lottery.id)}
                      disabled={loading}
                      className="px-4 py-2 bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 rounded-lg hover:bg-yellow-500/30 transition-colors disabled:opacity-50"
                    >
                      Draw Winners
                    </button>
                  )}
                  
                  {lottery.winners.includes(account) && (
                    <button
                      onClick={() => claimPrize(lottery.id)}
                      disabled={loading}
                      className="px-4 py-2 bg-green-500/20 text-green-400 border border-green-500/30 rounded-lg hover:bg-green-500/30 transition-colors disabled:opacity-50"
                    >
                      Claim Prize
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
          
          {lotteries.length === 0 && (
            <div className="text-center py-12">
              <div className="text-gray-400 text-lg">No lotteries</div>
              <div className="text-gray-500 text-sm mt-2">Create the first lottery to get started</div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default App;
