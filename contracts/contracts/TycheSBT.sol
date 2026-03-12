// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./interfaces/IERC5192.sol";
import "./base/ReactiveBase.sol";

/**
 * @title TycheSBT
 * @notice Soulbound Token implementing ERC-5192 for Tyche reputation identities.
 *
 *         One SBT per wallet. Non-transferable (locked forever after mint).
 *         Metadata evolves automatically when a wallet's tier changes, powered
 *         by Somnia Reactivity SDK.
 *
 *         REACTIVITY INTEGRATION (SC-08):
 *         ──────────────────────────────────────────────────────────────────
 *         Subscribes to TierChanged events from TycheScoreRegistry.
 *         When a tier change is detected, react() is called automatically:
 *           - If wallet has no SBT: mint one at the new tier
 *           - If wallet has SBT: evolve metadata to reflect new tier
 *         No manual calls. No keeper. Pure reactive automation.
 *         ──────────────────────────────────────────────────────────────────
 *
 * @dev SC-07 (ERC-5192 SBT) + SC-08 (Reactive evolution)
 *      Tyche | Somnia Reactivity Mini Hackathon 2026
 */
contract TycheSBT is ERC721, Ownable, ReactiveBase, IERC5192 {

    // -------------------------------------------------------------------------
    // Types
    // -------------------------------------------------------------------------

    struct SBTData {
        uint8   tier;               // 0=Bronze … 4=Oracle
        uint256 lastEvolutionBlock; // block when tier was last updated
        string  tokenURI;           // IPFS URI for tier visual metadata
    }

    // -------------------------------------------------------------------------
    // Events
    // -------------------------------------------------------------------------

    /// @notice Emitted when an SBT's tier metadata is updated
    event SBTEvolved(uint256 indexed tokenId, address indexed wallet, uint8 newTier, string newURI);

    /// @notice Emitted when a new SBT is minted
    event SBTMinted(uint256 indexed tokenId, address indexed wallet, uint8 tier);

    // ─── Somnia Reactivity subscription signal ────────────────────────────────
    event Subscribed(
        address indexed service,
        uint256 chainId,
        address indexed origin,
        uint256 topic0,
        uint256 topic1,
        uint256 topic2,
        uint256 topic3,
        bool    topic0Match,
        bool    topic3Match,
        uint256 gasLimit
    );

    // -------------------------------------------------------------------------
    // Constants
    // -------------------------------------------------------------------------

    /// @notice TierChanged(address,uint8,uint8) topic
    bytes32 public constant TIER_CHANGED_TOPIC0 =
        keccak256("TierChanged(address,uint8,uint8)");

    string[5] public TIER_NAMES = ["Bronze", "Silver", "Gold", "Platinum", "Oracle"];

    // -------------------------------------------------------------------------
    // State
    // -------------------------------------------------------------------------

    uint256 private _nextTokenId;

    /// @notice Token data per tokenId
    mapping(uint256 => SBTData) private _sbtData;

    /// @notice tokenId for a given wallet (0 = no SBT)
    mapping(address => uint256) public tokenIdOf;

    /// @notice Base URIs per tier (owner-configurable after IPFS upload)
    string[5] public tierBaseURIs;

    /// @notice TycheScoreRegistry contract address
    address public scoreRegistry;

    // -------------------------------------------------------------------------
    // Constructor
    // -------------------------------------------------------------------------

    /**
     * @param _reactiveService  Somnia Reactivity service address
     * @param _scoreRegistry    TycheScoreRegistry — we subscribe to its TierChanged events
     */
    constructor(
        address _reactiveService,
        address _scoreRegistry
    )
        ERC721("Tyche Soulbound Identity", "TYCHE-SBT")
        Ownable(msg.sender)
        ReactiveBase(_reactiveService)
    {
        scoreRegistry = _scoreRegistry;

        // Default placeholder tier URIs (owner should update with real IPFS URIs)
        tierBaseURIs[0] = "ipfs://QmTycheBronze/metadata.json";
        tierBaseURIs[1] = "ipfs://QmTycheSilver/metadata.json";
        tierBaseURIs[2] = "ipfs://QmTycheGold/metadata.json";
        tierBaseURIs[3] = "ipfs://QmTychePlatinum/metadata.json";
        tierBaseURIs[4] = "ipfs://QmTycheOracle/metadata.json";

        // ─── SOMNIA REACTIVITY SUBSCRIPTION ──────────────────────────────
        // Subscribe to TierChanged events from TycheScoreRegistry.
        // Somnia reactive runtime will call react() on this contract
        // whenever a wallet's tier changes.
        emit Subscribed(
            _reactiveService,
            50312,
            _scoreRegistry,
            uint256(TIER_CHANGED_TOPIC0),
            0, 0, 0,
            true,
            false,
            500_000
        );
    }

    // ─────────────────────────────────────────────────────────────────────────
    // ERC-5192: Soulbound enforcement
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @notice All TycheSBT tokens are permanently locked (soulbound).
     * @dev Returns true for any existing tokenId.
     */
    function locked(uint256 tokenId) external view override returns (bool) {
        require(_ownerOf(tokenId) != address(0), "TycheSBT: token does not exist");
        return true;
    }

    /**
     * @notice Block all transfers. Only mints (from == address(0)) are allowed.
     * @dev Overrides ERC721._update which is called for mint, burn, and transfer.
     */
    function _update(address to, uint256 tokenId, address auth)
        internal
        override
        returns (address from)
    {
        from = super._update(to, tokenId, auth);
        // Allow mint (from == address(0)) but block transfer (from != address(0) && to != address(0))
        if (from != address(0) && to != address(0)) {
            revert("TycheSBT: soulbound - transfers are disabled");
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Core: Mint & Evolve
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @notice Mint an SBT to a wallet. One per wallet.
     *         Called by owner, scoreRegistry, or reactive callback.
     * @param to      Recipient wallet
     * @param tier    Initial tier (0–4)
     */
    function mint(address to, uint8 tier) public {
        require(
            msg.sender == owner() ||
            msg.sender == scoreRegistry ||
            msg.sender == reactiveService,
            "TycheSBT: unauthorized minter"
        );
        require(to != address(0), "TycheSBT: zero address");
        require(tokenIdOf[to] == 0, "TycheSBT: wallet already has SBT");
        require(tier <= 4, "TycheSBT: invalid tier");

        _nextTokenId++;
        uint256 tokenId = _nextTokenId;

        _safeMint(to, tokenId);
        tokenIdOf[to] = tokenId;

        string memory uri = tierBaseURIs[tier];
        _sbtData[tokenId] = SBTData({
            tier:               tier,
            lastEvolutionBlock: block.number,
            tokenURI:           uri
        });

        emit Locked(tokenId);
        emit SBTMinted(tokenId, to, tier);
    }

    /**
     * @notice Evolve an existing SBT to a new tier, updating its metadata URI.
     *         Called by owner, scoreRegistry, or reactive callback.
     * @param wallet  The wallet whose SBT to evolve
     * @param newTier The new tier (0–4)
     */
    function evolve(address wallet, uint8 newTier) public {
        require(
            msg.sender == owner() ||
            msg.sender == scoreRegistry ||
            msg.sender == reactiveService,
            "TycheSBT: unauthorized"
        );
        require(newTier <= 4, "TycheSBT: invalid tier");

        uint256 tokenId = tokenIdOf[wallet];
        require(tokenId != 0, "TycheSBT: wallet has no SBT");

        string memory uri = tierBaseURIs[newTier];
        _sbtData[tokenId] = SBTData({
            tier:               newTier,
            lastEvolutionBlock: block.number,
            tokenURI:           uri
        });

        emit SBTEvolved(tokenId, wallet, newTier, uri);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Somnia Reactivity — TierChanged callback (SC-08)
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @notice Called automatically by Somnia Reactivity when TycheScoreRegistry
     *         emits TierChanged(address indexed wallet, uint8 oldTier, uint8 newTier).
     *
     *         topic1 = indexed wallet address
     *         data   = abi.encode(oldTier, newTier)
     */
    function _onReact(
        uint256 /* chainId */,
        address _contract,
        uint256 topic0,
        uint256 topic1,
        uint256 /* topic2 */,
        uint256 /* topic3 */,
        bytes calldata data,
        uint256 /* blockNumber */,
        uint256 /* opCode */
    ) internal override {
        if (_contract != scoreRegistry) return;
        if (bytes32(topic0) != TIER_CHANGED_TOPIC0) return;

        address wallet  = address(uint160(topic1));
        (, uint8 newTier) = abi.decode(data, (uint8, uint8));

        if (tokenIdOf[wallet] == 0) {
            // Wallet has no SBT yet — mint one automatically
            // (only if tier > 0 to avoid minting at default Bronze for new wallets)
            if (newTier > 0 || true) { // mint at any tier on first tier event
                _mintInternal(wallet, newTier);
            }
        } else {
            // Wallet already has SBT — evolve it
            _evolveInternal(wallet, newTier);
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Internal helpers (bypass authorization for reactive callbacks)
    // ─────────────────────────────────────────────────────────────────────────

    function _mintInternal(address to, uint8 tier) internal {
        if (tokenIdOf[to] != 0) return; // double-check

        _nextTokenId++;
        uint256 tokenId = _nextTokenId;

        _safeMint(to, tokenId);
        tokenIdOf[to] = tokenId;

        string memory uri = tierBaseURIs[tier];
        _sbtData[tokenId] = SBTData({
            tier:               tier,
            lastEvolutionBlock: block.number,
            tokenURI:           uri
        });

        emit Locked(tokenId);
        emit SBTMinted(tokenId, to, tier);
    }

    function _evolveInternal(address wallet, uint8 newTier) internal {
        uint256 tokenId = tokenIdOf[wallet];
        if (tokenId == 0) return;

        string memory uri = tierBaseURIs[newTier];
        _sbtData[tokenId] = SBTData({
            tier:               newTier,
            lastEvolutionBlock: block.number,
            tokenURI:           uri
        });

        emit SBTEvolved(tokenId, wallet, newTier, uri);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // ERC-721 metadata overrides
    // ─────────────────────────────────────────────────────────────────────────

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        require(_ownerOf(tokenId) != address(0), "TycheSBT: token does not exist");
        return _sbtData[tokenId].tokenURI;
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721)
        returns (bool)
    {
        // ERC-5192 interface ID: 0xb45a3c0e
        return interfaceId == type(IERC5192).interfaceId || super.supportsInterface(interfaceId);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Getters
    // ─────────────────────────────────────────────────────────────────────────

    function getSBTData(uint256 tokenId) external view returns (SBTData memory) {
        return _sbtData[tokenId];
    }

    function getSBTDataByWallet(address wallet) external view returns (SBTData memory) {
        return _sbtData[tokenIdOf[wallet]];
    }

    function totalSupply() external view returns (uint256) {
        return _nextTokenId;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Admin
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @notice Update IPFS base URIs per tier (call after uploading tier visuals to IPFS).
     */
    function setTierBaseURI(uint8 tier, string calldata uri) external onlyOwner {
        require(tier <= 4, "TycheSBT: invalid tier");
        tierBaseURIs[tier] = uri;
    }

    function setScoreRegistry(address _scoreRegistry) external onlyOwner {
        scoreRegistry = _scoreRegistry;
    }
}
