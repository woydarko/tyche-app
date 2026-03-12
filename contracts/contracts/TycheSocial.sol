// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./base/ReactiveBase.sol";

/**
 * @title TycheSocial
 * @notice On-chain social follow graph for Tyche predictors.
 *
 *         Wallets can follow/unfollow each other to build a social reputation
 *         network. When a followed wallet has a prediction resolved, followers
 *         receive an automatic on-chain alert — powered by Somnia Reactivity.
 *
 *         REACTIVE SOCIAL FEED (SC-12):
 *         ──────────────────────────────────────────────────────────────────
 *         Subscribes to PredictionResolved events from TycheMarketAdapter.
 *         When actor (wallet) resolves a prediction:
 *           For each follower of actor → emit PositionAlert(follower, actor, marketId)
 *         This PositionAlert is picked up by the backend WebSocket indexer
 *         to push live notifications to the frontend social feed.
 *         ──────────────────────────────────────────────────────────────────
 *
 * @dev SC-11 (follow graph) + SC-12 (reactive social alerts)
 *      Tyche | Somnia Reactivity Mini Hackathon 2026
 */
contract TycheSocial is Ownable, ReactiveBase {

    // -------------------------------------------------------------------------
    // Events
    // -------------------------------------------------------------------------

    /// @notice Emitted when a wallet follows another
    event FollowCreated(address indexed follower, address indexed target);

    /// @notice Emitted when a wallet unfollows another
    event FollowRemoved(address indexed follower, address indexed target);

    /**
     * @notice Emitted reactively when a followed predictor resolves a prediction.
     *         The backend WebSocket indexer listens for this to push live alerts.
     * @param follower  The wallet that follows the actor
     * @param actor     The wallet that resolved the prediction
     * @param marketId  The market identifier
     * @param result    Whether the actor won
     */
    event PositionAlert(
        address indexed follower,
        address indexed actor,
        string  marketId,
        bool    result
    );

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

    /// @notice PredictionResolved(address,string,string,bool,int256,uint256,uint256,uint256)
    bytes32 public constant PREDICTION_RESOLVED_TOPIC0 =
        keccak256("PredictionResolved(address,string,string,bool,int256,uint256,uint256,uint256)");

    /// @notice Max followers to alert per reactive callback (gas safety cap)
    uint256 public constant MAX_ALERT_BATCH = 50;

    /// @notice Max follows per wallet (anti-spam)
    uint256 public constant MAX_FOLLOWING = 500;

    // -------------------------------------------------------------------------
    // State  (SC-11)
    // -------------------------------------------------------------------------

    /// @notice Wallets that `addr` is following
    mapping(address => address[]) private _following;

    /// @notice Wallets that follow `addr`
    mapping(address => address[]) private _followers;

    /// @notice O(1) lookup: isFollowing[follower][target]
    mapping(address => mapping(address => bool)) public isFollowing;

    /// @notice Index of follower in target's _followers array (for O(1) removal)
    mapping(address => mapping(address => uint256)) private _followerIndex;

    /// @notice Index of target in follower's _following array (for O(1) removal)
    mapping(address => mapping(address => uint256)) private _followingIndex;

    /// @notice Address of TycheMarketAdapter (event source)
    address public marketAdapter;

    // -------------------------------------------------------------------------
    // Constructor
    // -------------------------------------------------------------------------

    /**
     * @param _reactiveService  Somnia Reactivity service address
     * @param _marketAdapter    TycheMarketAdapter — source of PredictionResolved events
     */
    constructor(
        address _reactiveService,
        address _marketAdapter
    )
        Ownable(msg.sender)
        ReactiveBase(_reactiveService)
    {
        marketAdapter = _marketAdapter;

        // ─── SOMNIA REACTIVITY SUBSCRIPTION (SC-12) ──────────────────────
        // Subscribe to PredictionResolved events from TycheMarketAdapter.
        // When a prediction resolves, react() is called automatically,
        // which fans out PositionAlert events to all followers.
        emit Subscribed(
            _reactiveService,
            50312,
            _marketAdapter,
            uint256(PREDICTION_RESOLVED_TOPIC0),
            0, 0, 0,
            true,
            false,
            2_000_000
        );
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Follow graph (SC-11)
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @notice Follow another wallet.
     * @param target The wallet to follow (cannot be self)
     */
    function follow(address target) external {
        require(target != address(0),   "TycheSocial: zero address");
        require(target != msg.sender,   "TycheSocial: cannot follow self");
        require(!isFollowing[msg.sender][target], "TycheSocial: already following");
        require(_following[msg.sender].length < MAX_FOLLOWING, "TycheSocial: following limit reached");

        // Track follow relationship
        isFollowing[msg.sender][target] = true;

        _followingIndex[msg.sender][target] = _following[msg.sender].length;
        _following[msg.sender].push(target);

        _followerIndex[msg.sender][target] = _followers[target].length;
        _followers[target].push(msg.sender);

        emit FollowCreated(msg.sender, target);
    }

    /**
     * @notice Unfollow a wallet.
     * @param target The wallet to unfollow
     */
    function unfollow(address target) external {
        require(isFollowing[msg.sender][target], "TycheSocial: not following");

        isFollowing[msg.sender][target] = false;

        // Remove from _following[msg.sender] using swap-and-pop
        _swapAndPop(_following[msg.sender], _followingIndex[msg.sender][target]);
        // Fix index of the element that was swapped in
        if (_followingIndex[msg.sender][target] < _following[msg.sender].length) {
            address movedAddr = _following[msg.sender][_followingIndex[msg.sender][target]];
            _followingIndex[msg.sender][movedAddr] = _followingIndex[msg.sender][target];
        }
        delete _followingIndex[msg.sender][target];

        // Remove from _followers[target] using swap-and-pop
        _swapAndPop(_followers[target], _followerIndex[msg.sender][target]);
        if (_followerIndex[msg.sender][target] < _followers[target].length) {
            address movedAddr = _followers[target][_followerIndex[msg.sender][target]];
            _followerIndex[movedAddr][target] = _followerIndex[msg.sender][target];
        }
        delete _followerIndex[msg.sender][target];

        emit FollowRemoved(msg.sender, target);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Somnia Reactivity — PredictionResolved callback (SC-12)
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @notice Called automatically by Somnia Reactivity when a prediction resolves.
     *         Emits PositionAlert for each follower of the actor wallet.
     *
     *         topic1 = actor wallet (indexed in PredictionResolved)
     *         data   = abi.encode(marketId, category, result, pnl, ...)
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
        if (_contract != marketAdapter) return;
        if (bytes32(topic0) != PREDICTION_RESOLVED_TOPIC0) return;

        address actor = address(uint160(topic1));

        address[] storage followerList = _followers[actor];
        uint256 count = followerList.length;
        if (count == 0) return;

        // Decode just what we need for the alert
        (string memory marketId, , bool result) =
            abi.decode(data, (string, string, bool));

        // Fan out PositionAlert to all followers (capped at MAX_ALERT_BATCH)
        uint256 limit = count < MAX_ALERT_BATCH ? count : MAX_ALERT_BATCH;
        for (uint256 i = 0; i < limit; i++) {
            emit PositionAlert(followerList[i], actor, marketId, result);
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Getters
    // ─────────────────────────────────────────────────────────────────────────

    /// @notice List of wallets that `addr` is following
    function getFollowing(address addr) external view returns (address[] memory) {
        return _following[addr];
    }

    /// @notice List of wallets that follow `addr`
    function getFollowers(address addr) external view returns (address[] memory) {
        return _followers[addr];
    }

    /// @notice Number of wallets `addr` follows
    function followingCount(address addr) external view returns (uint256) {
        return _following[addr].length;
    }

    /// @notice Number of wallets following `addr`
    function followerCount(address addr) external view returns (uint256) {
        return _followers[addr].length;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Internal utilities
    // ─────────────────────────────────────────────────────────────────────────

    /// @dev Swap element at `index` with last element and pop. O(1).
    function _swapAndPop(address[] storage arr, uint256 index) internal {
        uint256 last = arr.length - 1;
        if (index != last) {
            arr[index] = arr[last];
        }
        arr.pop();
    }
}
