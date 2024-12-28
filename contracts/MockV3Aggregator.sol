// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

contract MockV3Aggregator {
    uint8 public immutable decimals;
    int256 public price;

    constructor(uint8 _decimals, int256 _initialAnswer) {
        decimals = _decimals;
        price = _initialAnswer;
    }

    function latestRoundData()
        external
        view
        returns (
            uint80 roundId,
            int256 answer,
            uint256 startedAt,
            uint256 updatedAt,
            uint80 answeredInRound
        )
    {
        return (
            1,              // roundId
            price,          // answer
            block.timestamp,// startedAt
            block.timestamp,// updatedAt
            1              // answeredInRound
        );
    }

    // Function to update price (for testing different scenarios)
    function updatePrice(int256 _price) external {
        price = _price;
    }
}