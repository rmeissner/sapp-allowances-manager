import React, { useCallback, useEffect, useMemo, useState } from 'react';
import logo from './logo.svg';
import { BigNumber, ethers } from 'ethers';
import './App.css';

const Erc20 = [
  "function approve(address _spender, uint256 _value) public returns (bool success)",
  "function allowance(address _owner, address _spender) public view returns (uint256 remaining)",
  "event Approval(address indexed _owner, address indexed _spender, uint256 _value)"
];
const Erc20Interface = new ethers.utils.Interface(Erc20)

declare global {
  interface Window { ethereum: any; }
}

interface Allowance {
  token: string,
  spender: string,
  allowance: BigNumber
}

const App: React.FC = () => {

  // Wallet logic
  const checkProviderEnabled = useCallback(async () => {
    await window.ethereum.enable()
  }, [window.ethereum])
  const walletAddress = useCallback(async () => {
    await checkProviderEnabled()
    return await provider.getSigner().getAddress()
  }, [checkProviderEnabled, window.ethereum])

  // Build provider 
  const provider = useMemo(() => new ethers.providers.Web3Provider(window.ethereum), [window.ethereum])

  // Allowances loading logic
  const [allowances, setAllowances] = useState<Allowance[]>([])
  const loadAllowances = useCallback(async () => {
    try {
      const owner = await walletAddress()
      const eventInterface = Erc20Interface.getEvent("Approval")
      const filter = {
        topics: Erc20Interface.encodeFilterTopics(eventInterface, [owner]),
        fromBlock: "earliest"
      }
      const logs = await provider.getLogs(filter)

      const pastAllowances: Record<string, Record<string, boolean>> = {}
      logs.forEach((log) => {
        if (!pastAllowances[log.address]) pastAllowances[log.address] = {}
        const event = Erc20Interface.decodeEventLog(eventInterface, log.data, log.topics)
        pastAllowances[log.address][event._spender] = true
      })

      // Check current state of allowances
      const allowances = []
      for (const token of Object.keys(pastAllowances)) {
        const contract = new ethers.Contract( token , Erc20 , provider )
        for (const spender of Object.keys(pastAllowances[token])) {
          const allowance: BigNumber = (await contract.allowance(owner, spender))
          if (allowance.gt(0)) allowances.push({
            token, spender, allowance
          })
        }
      }
      setAllowances(allowances)
    } catch (e) {
      console.error(e)
    }
  }, [walletAddress, provider, setAllowances])

  useEffect(() => {
    loadAllowances()
  }, [loadAllowances])


  // Allowances reset logic
  const resetAllowance = useCallback(async(token: string, spender: string) => {
    const tokenContract = new ethers.Contract( token , Erc20 , provider.getSigner() )
    try {
      await tokenContract.approve(spender, 0)
    } catch (e) {
      console.error(e)
    }
  }, [provider])

  return (
    <div className="App">
      <header className="App-header">
        <img src={logo} className="App-logo" alt="logo" />
        <p>
          Current allowances
        </p>
        {allowances.map(allowance => <div>
          Token: {allowance.token}<br />
          Spender: {allowance.spender}<br />
          Allowance: {allowance.allowance.toString()}<br />
          <span onClick={() => resetAllowance(allowance.token, allowance.spender)}>Reset</span>
          <hr />
        </div>)}
      </header>
    </div>
  );
}

export default App;
