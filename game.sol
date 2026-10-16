
 // SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract ResourceAlchemy {

    // Collection cooldown: 30 seconds
    uint256 public constant COLLECTION_COOLDOWN = 30;

    // Goal: craft 3 tools
    uint256 public constant WINNING_GOAL = 3;

    // Player inventory
    mapping(address => uint256) public wood;
    mapping(address => uint256) public stone;
    mapping(address => uint256) public craftedItems;

    // Last collection timestamps
    mapping(address => uint256) public lastWoodCollection;
    mapping(address => uint256) public lastStoneCollection;

    // Achievement status
    mapping(address => bool) public hasWon;

    // Events
    event ResourceCollected(
        address indexed player,
        string resource,
        uint256 amount
    );

    event ItemCrafted(
        address indexed player,
        uint256 totalCrafted
    );

    event AchievementUnlocked(address indexed player);

    // Collect 3 wood
    function collectWood() public {
        require(
            block.timestamp >=
                lastWoodCollection[msg.sender] + COLLECTION_COOLDOWN,
            "Wait before collecting wood"
        );

        wood[msg.sender] += 3;
        lastWoodCollection[msg.sender] = block.timestamp;

        emit ResourceCollected(msg.sender, "wood", 3);
    }

    // Collect 2 stones
    function collectStone() public {
        require(
            block.timestamp >=
                lastStoneCollection[msg.sender] + COLLECTION_COOLDOWN,
            "Wait before collecting stones"
        );

        stone[msg.sender] += 2;
        lastStoneCollection[msg.sender] = block.timestamp;

        emit ResourceCollected(msg.sender, "stone", 2);
    }

    // Craft one tool: 2 wood + 1 stone
    function craftItem() public {
        require(wood[msg.sender] >= 2, "Not enough wood");
        require(stone[msg.sender] >= 1, "Not enough stone");

        wood[msg.sender] -= 2;
        stone[msg.sender] -= 1;

        craftedItems[msg.sender] += 1;

        emit ItemCrafted(
            msg.sender,
            craftedItems[msg.sender]
        );

        // Unlock achievement once the goal is reached
        if (
            craftedItems[msg.sender] >= WINNING_GOAL &&
            !hasWon[msg.sender]
        ) {
            hasWon[msg.sender] = true;
            emit AchievementUnlocked(msg.sender);
        }
    }
}