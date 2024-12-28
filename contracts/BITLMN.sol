// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC20Burnable} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title BLMN Token
 * @dev ERC20 token for BLMN with initial supply distribution and transfer locking capability
 * @custom:security-contact security@blmn.com
 */
contract BLMN is ERC20, ERC20Burnable, Ownable {
    /*//////////////////////////////////////////////////////////////
                                ERRORS
    //////////////////////////////////////////////////////////////*/
    error BLMN_TransferLocked();
    error BLMN_ZeroAddress();

    /*//////////////////////////////////////////////////////////////
                            STATE VARIABLES
    //////////////////////////////////////////////////////////////*/

    // Token distribution constants (in basis points for gas optimization)
    uint256 private constant TOTAL_SUPPLY = 1_000_000_000 * 1e18; // 1 billion tokens with 18 decimals
    uint256 private constant PRESALE_BPS = 5500;    // 55%
    uint256 private constant MARKETING_BPS = 1200;  // 12%
    uint256 private constant EXCHANGE_BPS = 1000;   // 10%
    uint256 private constant REWARDS_BPS = 1800;    // 18%
    uint256 private constant TEAM_BPS = 500;        // 5%
    uint256 private constant BPS = 10000;           // 100%

    // Reserve addresses
    address public immutable PRESALE_ADDRESS;
    address public immutable MARKETING_ADDRESS;
    address public immutable EXCHANGE_ADDRESS;
    address public immutable REWARDS_ADDRESS;
    address public immutable TEAM_ADDRESS;
    address public immutable BURN_ADDRESS;

    // Transfer lock status
    bool public transferLocked;

    /*//////////////////////////////////////////////////////////////
                                EVENTS
    //////////////////////////////////////////////////////////////*/
    event TransferLockUpdated(bool indexed locked);

    /*//////////////////////////////////////////////////////////////
                            CONSTRUCTOR
    //////////////////////////////////////////////////////////////*/

    /**
     * @dev Sets up the token with initial distribution
     * @param presale Presale reserve address
     * @param marketing Marketing reserve address
     * @param exchange Exchange listings reserve address
     * @param rewards Rewards reserve address
     * @param team Team and advisors reserve address
     * @param burn Burn address for future token burns
     */
    constructor(
        address presale,
        address marketing,
        address exchange,
        address rewards,
        address team,
        address burn
    ) ERC20("BLEM", "BLEM") Ownable(msg.sender) {
        if (presale == address(0) || 
            marketing == address(0) || 
            exchange == address(0) || 
            rewards == address(0) || 
            team == address(0) ||
            burn == address(0)) revert BLMN_ZeroAddress();

        PRESALE_ADDRESS = presale;
        MARKETING_ADDRESS = marketing;
        EXCHANGE_ADDRESS = exchange;
        REWARDS_ADDRESS = rewards;
        TEAM_ADDRESS = team;
        BURN_ADDRESS = burn;

        // Initial token distribution using basis points for precise calculation
        _mint(PRESALE_ADDRESS, (TOTAL_SUPPLY * PRESALE_BPS) / BPS);
        _mint(MARKETING_ADDRESS, (TOTAL_SUPPLY * MARKETING_BPS) / BPS);
        _mint(EXCHANGE_ADDRESS, (TOTAL_SUPPLY * EXCHANGE_BPS) / BPS);
        _mint(REWARDS_ADDRESS, (TOTAL_SUPPLY * REWARDS_BPS) / BPS);
        _mint(TEAM_ADDRESS, (TOTAL_SUPPLY * TEAM_BPS) / BPS);

        // Initially lock transfers for security
        transferLocked = true;
        emit TransferLockUpdated(true);
    }

    /*//////////////////////////////////////////////////////////////
                            ADMIN FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /**
     * @dev Enables or disables token transfers
     * @param locked New lock status
     */
    function setTransferLock(bool locked) external onlyOwner {
        transferLocked = locked;
        emit TransferLockUpdated(locked);
    }

    /*//////////////////////////////////////////////////////////////
                            OVERRIDES
    //////////////////////////////////////////////////////////////*/

    /**
     * @dev Hook that is called before any transfer of tokens
     * @dev Reverts if transfers are locked
     */
    function _update(
        address from,
        address to,
        uint256 amount
    ) internal virtual override {
        if (transferLocked) revert BLMN_TransferLocked();
        super._update(from, to, amount);
    }
}