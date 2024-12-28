// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import "@chainlink/contracts/src/v0.8/shared/interfaces/AggregatorV3Interface.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract BLMNPresale is Ownable, ReentrancyGuard {
    /*//////////////////////////////////////////////////////////////
                           ERRORS
    //////////////////////////////////////////////////////////////*/
    error PRESALE_InvalidPrice();
    error PRESALE_InsufficientETH();
    error PRESALE_TokenNotSet();
    error PRESALE_NotActive();
    error PRESALE_TransferFailed();
    error PRESALE_InsufficientBalance();
    error PRESALE_NoBalanceToWithdraw();
    error PRESALE_WithdrawFailed();
    error PRESALE_AlreadyClaimed();
    error PRESALE_OracleFailed();
    error PRESALE_UnsupportedNetwork();
    error PRESALE_ClaimingNotEnabled();
    error PRESALE_InvalidPurchaseAmount();

    /*//////////////////////////////////////////////////////////////
                           STRUCTS AND ENUMS
    //////////////////////////////////////////////////////////////*/
    struct StageInfo {
        uint256 priceUSD; // Price in USD with 18 decimals
        uint256 soldTokens; // Tokens sold in this stage
        bool active; // Whether the stage is active
    }

    struct UserInfo {
        uint256 tokenAmount; // Amount of tokens purchased
        uint256 ethContributed; // Total ETH contributed
        uint256 timestamp; // Time of purchase
        bool claimed; // Whether tokens have been claimed
        uint256 stageId; // Stage ID of purchase
    }

    /*//////////////////////////////////////////////////////////////
                            CONSTANTS
    //////////////////////////////////////////////////////////////*/
    uint256 private constant PRECISION = 1e18;

    // Chainlink Price Feed addresses for different networks
    address private constant BASE_ETH_USD_FEED =
        0x71041dddad3595F9CEd3DcCFBe3D1F4b0a16Bb70;
    address private constant ARBITRUM_ETH_USD_FEED =
        0x639Fe6ab55C921f74e7fac1ee960C0B6293ba612;
    address private constant OPTIMISM_ETH_USD_FEED =
        0x13e3Ee699D1909E989722E753853AE30b17e08c5;

    /*//////////////////////////////////////////////////////////////
                            STATE VARIABLES
    //////////////////////////////////////////////////////////////*/
    IERC20 public blmnToken;
    AggregatorV3Interface public immutable ethUsdPriceFeed;

    uint256 public currentStageId;
    uint256 public totalTokensSold;
    uint256 public totalUSDRaised;
    uint256 public totalEthRaised;

    bool public claimingEnabled;
    bool public presaleEnded;

    mapping(uint256 => StageInfo) public stages;
    mapping(address => UserInfo) public userInfo;

    /*//////////////////////////////////////////////////////////////
                              EVENTS
    //////////////////////////////////////////////////////////////*/
    event TokensPurchased(
        address indexed buyer,
        uint256 tokenAmount,
        uint256 ethPaid,
        uint256 usdValue,
        uint256 stageId
    );
    event TokensClaimed(address indexed user, uint256 amount);
    event StageCreated(uint256 stageId, uint256 priceUSD);
    event PresaleStatusUpdated(bool ended, bool claimingEnabled);
    event RefundIssued(address indexed user, uint256 amount);

    /*//////////////////////////////////////////////////////////////
                              MODIFIERS
    //////////////////////////////////////////////////////////////*/
    modifier whenNotEnded() {
        if (presaleEnded) revert PRESALE_NotActive();
        _;
    }

    modifier whenClaimingEnabled() {
        if (!claimingEnabled) revert PRESALE_ClaimingNotEnabled();
        _;
    }

    /*//////////////////////////////////////////////////////////////
                              CONSTRUCTOR
    //////////////////////////////////////////////////////////////*/
    constructor(address _priceFeedAddress) Ownable(msg.sender) {
        if (_priceFeedAddress == address(0)) {
            // Determine network and set appropriate price feed
            uint256 chainId;
            assembly {
                chainId := chainid()
            }

            if (chainId == 8453) {
                _priceFeedAddress = BASE_ETH_USD_FEED;
            } else if (chainId == 42161) {
                _priceFeedAddress = ARBITRUM_ETH_USD_FEED;
            } else if (chainId == 10) {
                _priceFeedAddress = OPTIMISM_ETH_USD_FEED;
            } else {
                revert PRESALE_UnsupportedNetwork();
            }
        }

        ethUsdPriceFeed = AggregatorV3Interface(_priceFeedAddress);
    }

    /*//////////////////////////////////////////////////////////////
                            INTERNAL FUNCTIONS
    //////////////////////////////////////////////////////////////*/
    function _getEthPrice() internal view returns (uint256) {
        (, int256 price, , , ) = ethUsdPriceFeed.latestRoundData();
        if (price <= 0) revert PRESALE_OracleFailed();
        return uint256(price) * 1e10; // Convert to 18 decimals
    }

    function _getEthAmountForUSD(uint256 usdAmount) internal view returns (uint256) {
        uint256 ethPrice = _getEthPrice();
        return (usdAmount * PRECISION) / ethPrice;
    }

    function _getUSDAmountForETH(uint256 ethAmount) internal view returns (uint256) {
        uint256 ethPrice = _getEthPrice();
        return (ethAmount * ethPrice) / PRECISION;
    }

    /*//////////////////////////////////////////////////////////////
                            EXTERNAL FUNCTIONS
    //////////////////////////////////////////////////////////////*/
    function nextStage(uint256 priceUSD) external onlyOwner {
        if (priceUSD == 0) revert PRESALE_InvalidPrice();
        
        // Deactivate current stage if it exists
        if (stages[currentStageId].active) {
            stages[currentStageId].active = false;
        }

        // Increment stage ID and create new stage
        currentStageId++;
        
        stages[currentStageId] = StageInfo({
            priceUSD: priceUSD,
            soldTokens: 0,
            active: true
        });

        emit StageCreated(currentStageId, priceUSD);
    }

    function purchaseTokens(uint256 tokenAmount) external payable nonReentrant whenNotEnded {
        if (address(blmnToken) == address(0)) revert PRESALE_TokenNotSet();

        StageInfo storage stage = stages[currentStageId];
        if (!stage.active) revert PRESALE_NotActive();

        // Calculate USD value
        uint256 usdCost = (tokenAmount * stage.priceUSD) / PRECISION;

        // Calculate required ETH
        uint256 ethRequired = _getEthAmountForUSD(usdCost);
        if (msg.value < ethRequired) revert PRESALE_InsufficientETH();

        // Update state
        stage.soldTokens += tokenAmount;
        totalTokensSold += tokenAmount;
        totalUSDRaised += usdCost;
        totalEthRaised += ethRequired;

        // Update user info
        UserInfo storage user = userInfo[msg.sender];
        user.tokenAmount += tokenAmount;
        user.ethContributed += ethRequired;
        user.timestamp = block.timestamp;
        user.stageId = currentStageId;
        user.claimed = false;

        // Refund excess ETH
        uint256 excess = msg.value - ethRequired;
        if (excess > 0) {
            (bool success, ) = payable(msg.sender).call{value: excess}("");
            if (!success) revert PRESALE_WithdrawFailed();
        }

        emit TokensPurchased(
            msg.sender,
            tokenAmount,
            ethRequired,
            usdCost,
            currentStageId
        );
    }

    function claimTokens() external nonReentrant whenClaimingEnabled {
        UserInfo storage user = userInfo[msg.sender];
        if (user.tokenAmount == 0 || user.claimed) revert PRESALE_AlreadyClaimed();

        uint256 amount = user.tokenAmount;
        if (blmnToken.balanceOf(address(this)) < amount)
            revert PRESALE_InsufficientBalance();

        user.claimed = true;
        bool success = blmnToken.transfer(msg.sender, amount);
        if (!success) revert PRESALE_TransferFailed();

        emit TokensClaimed(msg.sender, amount);
    }

    function requestRefund() external nonReentrant {
        if (!presaleEnded) revert PRESALE_NotActive();

        UserInfo storage user = userInfo[msg.sender];
        if (user.tokenAmount == 0 || user.claimed) revert PRESALE_AlreadyClaimed();

        uint256 refundAmount = user.ethContributed;
        if (refundAmount == 0) revert PRESALE_NoBalanceToWithdraw();

        // Update state before transfer
        user.claimed = true;
        user.tokenAmount = 0;
        user.ethContributed = 0;

        // Process refund
        (bool success, ) = payable(msg.sender).call{value: refundAmount}("");
        if (!success) revert PRESALE_WithdrawFailed();

        emit RefundIssued(msg.sender, refundAmount);
    }

    /*//////////////////////////////////////////////////////////////
                            ADMIN FUNCTIONS
    //////////////////////////////////////////////////////////////*/
    function setBlmnToken(address _token) external onlyOwner {
        if (_token == address(0)) revert PRESALE_TokenNotSet();
        blmnToken = IERC20(_token);
    }

    function updatePresaleStatus(bool ended, bool enableClaiming) external onlyOwner {
        presaleEnded = ended;
        claimingEnabled = enableClaiming;
        emit PresaleStatusUpdated(ended, enableClaiming);
    }

    function withdrawETH() external onlyOwner {
        uint256 balance = address(this).balance;
        if (balance == 0) revert PRESALE_NoBalanceToWithdraw();

        (bool success, ) = payable(owner()).call{value: balance}("");
        if (!success) revert PRESALE_WithdrawFailed();
    }

    function withdrawUnsoldTokens() external onlyOwner {
        if (address(blmnToken) == address(0)) revert PRESALE_TokenNotSet();
        if (!presaleEnded) revert PRESALE_NotActive();

        uint256 balance = blmnToken.balanceOf(address(this));
        if (balance == 0) revert PRESALE_NoBalanceToWithdraw();

        bool success = blmnToken.transfer(owner(), balance);
        if (!success) revert PRESALE_TransferFailed();
    }

    /*//////////////////////////////////////////////////////////////
                            VIEW FUNCTIONS
    //////////////////////////////////////////////////////////////*/
    function getCurrentStage() external view returns (
        uint256 stageId,
        uint256 priceUSD,
        uint256 soldTokens,
        bool active
    ) {
        StageInfo storage stage = stages[currentStageId];
        return (
            currentStageId,
            stage.priceUSD,
            stage.soldTokens,
            stage.active
        );
    }

    function getStageInfo(uint256 stageId) external view returns (StageInfo memory) {
        return stages[stageId];
    }

    function getUserPurchases(address user) external view returns (
        uint256 tokenAmount,
        uint256 ethContributed,
        uint256 timestamp,
        bool claimed,
        uint256 stageId
    ) {
        UserInfo storage userInfo_ = userInfo[user];
        return (
            userInfo_.tokenAmount,
            userInfo_.ethContributed,
            userInfo_.timestamp,
            userInfo_.claimed,
            userInfo_.stageId
        );
    }

    function getTokenPrice() external view returns (uint256 priceInUSD, uint256 priceInETH) {
        StageInfo storage stage = stages[currentStageId];
        if (!stage.active) revert PRESALE_NotActive();

        priceInUSD = stage.priceUSD;
        priceInETH = _getEthAmountForUSD(stage.priceUSD);
    }

    function getPresaleStatus() external view returns (
        bool isActive,
        bool isClaimingEnabled,
        bool isPresaleEnded
    ) {
        isActive = stages[currentStageId].active && !presaleEnded;
        isClaimingEnabled = claimingEnabled;
        isPresaleEnded = presaleEnded;
    }

    /**
     * @dev Emergency function to handle stuck tokens
     * @param token Address of the token to recover
     * @notice Cannot be used for the BLMN token itself
     */
    function recoverToken(address token) external onlyOwner {
        if (token == address(blmnToken)) revert PRESALE_InvalidPrice();

        uint256 balance = IERC20(token).balanceOf(address(this));
        if (balance == 0) revert PRESALE_NoBalanceToWithdraw();

        bool success = IERC20(token).transfer(owner(), balance);
        if (!success) revert PRESALE_TransferFailed();
    }

    /*//////////////////////////////////////////////////////////////
                            RECEIVE FUNCTION
    //////////////////////////////////////////////////////////////*/
    receive() external payable {
        revert PRESALE_InvalidPurchaseAmount();
    }
}