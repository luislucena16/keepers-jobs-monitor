import { ethers } from "ethers";

const sequencerAbi = [
  "function numJobs() view returns (uint256)",
  "function jobAt(uint256) view returns (address)"
];

export async function numJobs(provider: ethers.providers.Provider, sequencerAddress: string): Promise<number> {
  const contract = new ethers.Contract(sequencerAddress, sequencerAbi, provider);
  const jobsBN = await contract.numJobs();
  return jobsBN.toNumber(); // convert BigNumber to number JS
}

export async function jobAt(
  provider: ethers.providers.Provider,
  sequencerAddress: string,
  index: number
): Promise<string> {
  const contract = new ethers.Contract(sequencerAddress, sequencerAbi, provider);
  return contract.jobAt(index);
}
