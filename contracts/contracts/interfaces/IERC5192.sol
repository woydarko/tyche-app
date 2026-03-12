// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title IERC5192 — Minimal Soulbound Token Standard
 * @notice EIP-5192: https://eips.ethereum.org/EIPS/eip-5192
 *         A soulbound token is permanently locked to the minting address.
 */
interface IERC5192 {
    /// @notice Emitted when a token's transfer status is set to locked.
    event Locked(uint256 tokenId);

    /// @notice Emitted when a token's transfer status is set to unlocked.
    event Unlocked(uint256 tokenId);

    /**
     * @notice Returns the locking status of an EIP-5192 token.
     * @dev Throws if `tokenId` does not exist.
     * @param tokenId The identifier for an SBT.
     * @return true if the token is locked (soulbound), false if transferable.
     */
    function locked(uint256 tokenId) external view returns (bool);
}
