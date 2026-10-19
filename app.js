const CONTRACT_ADDRESS = "0xEf9803F3f98Afd0b3C8e95F6C2f1816d93c553B8";

const SEPOLIA_CHAIN_ID = 11155111n;
const COOLDOWN = 30;

// ABI for the ResourceAlchemy contract
const ABI = [
    "function wood(address) view returns (uint256)",
    "function stone(address) view returns (uint256)",
    "function craftedItems(address) view returns (uint256)",
    "function lastWoodCollection(address) view returns (uint256)",
    "function lastStoneCollection(address) view returns (uint256)",
    "function hasWon(address) view returns (bool)",
    "function collectWood()",
    "function collectStone()",
    "function craftItem()"
];

let provider;
let signer;
let contract;
let playerAddress;

let lastWoodTime = 0;
let lastStoneTime = 0;

const $ = (id) => document.getElementById(id);

function showStatus(message) {
    $("status").textContent = message;
}

function formatError(error) {
    if (error?.code === 4001) {
        return "You declined transaction in MetaMask.";
    }

    const message =
        error?.shortMessage ||
        error?.reason ||
        error?.message ||
        "Unknown error";

    if (message.includes("Wait before collecting wood")) {
        return "Wait till you can collect more wood.";
    }

    if (message.includes("Wait before collecting stones")) {
        return "Wait till you can collect more stone.";
    }

    if (message.includes("Not enough wood")) {
        return "Not enough wood to craft item.";
    }

    if (message.includes("Not enough stone")) {
        return "Not enough stone to craft item.";
    }

    return message;
}

async function connectWallet() {
    try {
        if (!window.ethereum) {
            showStatus("Install MetaMask to play.");
            return;
        }

        provider = new ethers.BrowserProvider(window.ethereum);

        await provider.send("eth_requestAccounts", []);

        let network = await provider.getNetwork();

        if (network.chainId !== SEPOLIA_CHAIN_ID) {
            try {
                await provider.send("wallet_switchEthereumChain", [
                    { chainId: "0xaa36a7" }
                ]);
            } catch (error) {
                showStatus(
                    "Switch MetaMask to the Sepolia network and reconnect.."
                );
                return;
            }

            provider = new ethers.BrowserProvider(window.ethereum);
            network = await provider.getNetwork();
        }

        if (network.chainId !== SEPOLIA_CHAIN_ID) {
            showStatus("Select the Sepolia network in MetaMask.");
            return;
        }

        signer = await provider.getSigner();
        playerAddress = await signer.getAddress();

        contract = new ethers.Contract(
            CONTRACT_ADDRESS,
            ABI,
            signer
        );

        $("wallet").textContent =
            "Wallet: " +
            playerAddress.slice(0, 6) +
            "..." +
            playerAddress.slice(-4);

        $("network").textContent = "Network: Sepolia";

        $("connectButton").textContent = "Wallet is connected";

        showStatus("Connection successful! Downloading data from the blockchain....");

        await refreshData();
    } catch (error) {
        showStatus("Connection error: " + formatError(error));
    }
}

async function refreshData() {
    if (!contract || !playerAddress) {
        showStatus("First, connect MetaMask.");
        return;
    }

    try {
        const [
            wood,
            stone,
            items,
            won,
            woodTime,
            stoneTime
        ] = await Promise.all([
            contract.wood(playerAddress),
            contract.stone(playerAddress),
            contract.craftedItems(playerAddress),
            contract.hasWon(playerAddress),
            contract.lastWoodCollection(playerAddress),
            contract.lastStoneCollection(playerAddress)
        ]);

        $("wood").textContent = wood.toString();
        $("stone").textContent = stone.toString();
        $("items").textContent = items.toString();

        $("achievement").textContent = won
            ? "🏆 Achievement unlocked!"
            : "The achievement is not yet unlocked.";

        lastWoodTime = Number(woodTime);
        lastStoneTime = Number(stoneTime);

        updateTimers();
        showStatus("Data successfully downloaded from blockchain.");
    } catch (error) {
        showStatus("Failed to read data: " + formatError(error));
    }
}

function updateTimers() {
    const now = Math.floor(Date.now() / 1000);

    const woodRemaining = Math.max(
        0,
        lastWoodTime + COOLDOWN - now
    );

    const stoneRemaining = Math.max(
        0,
        lastStoneTime + COOLDOWN - now
    );

    $("woodTimer").textContent = woodRemaining > 0
        ? `Next collection in ${woodRemaining} sec.`
        : "You can collect wood";

    $("stoneTimer").textContent = stoneRemaining > 0
        ? `Next collection in ${stoneRemaining} sec.`
        : "You can collect wood";

    $("woodButton").disabled =
        !contract || woodRemaining > 0;

    $("stoneButton").disabled =
        !contract || stoneRemaining > 0;

    $("craftButton").disabled = !contract;
}

async function sendTransaction(methodName, successMessage) {
    if (!contract) {
        showStatus("First, connect MetaMask.");
        return;
    }

    const buttons = [
        $("woodButton"),
        $("stoneButton"),
        $("craftButton")
    ];

    buttons.forEach(button => button.disabled = true);

    try {
        showStatus("Confirm the transaction in MetaMask...");

        const tx = await contract[methodName]();

        showStatus("The transaction has been sent. Awaiting confirmation....");

        await tx.wait();

        showStatus(successMessage);

        await refreshData();
    } catch (error) {
        showStatus("Error: " + formatError(error));
    } finally {
        updateTimers();
    }
}

$("connectButton").addEventListener("click", connectWallet);

$("refreshButton").addEventListener("click", refreshData);

$("woodButton").addEventListener("click", () =>
    sendTransaction("collectWood", "Ты собрал дерево!")
);

$("stoneButton").addEventListener("click", () =>
    sendTransaction("collectStone", "Ты собрал камень!")
);

$("craftButton").addEventListener("click", () =>
    sendTransaction("craftItem", "Предмет успешно создан!")
);

if (window.ethereum) {
    window.ethereum.on("accountsChanged", () => {
        location.reload();
    });

    window.ethereum.on("chainChanged", () => {
        location.reload();
    });
}

setInterval(updateTimers, 1000);
updateTimers();