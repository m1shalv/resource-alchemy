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
        return "Ты отклонил запрос в MetaMask.";
    }

    const message =
        error?.shortMessage ||
        error?.reason ||
        error?.message ||
        "Неизвестная ошибка";

    if (message.includes("Wait before collecting wood")) {
        return "Подожди перед следующим сбором дерева.";
    }

    if (message.includes("Wait before collecting stones")) {
        return "Подожди перед следующим сбором камня.";
    }

    if (message.includes("Not enough wood")) {
        return "Недостаточно дерева для создания предмета.";
    }

    if (message.includes("Not enough stone")) {
        return "Недостаточно камня для создания предмета.";
    }

    return message;
}

async function connectWallet() {
    try {
        if (!window.ethereum) {
            showStatus("Установи MetaMask, чтобы играть.");
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
                    "Переключи MetaMask на сеть Sepolia и подключись снова."
                );
                return;
            }

            provider = new ethers.BrowserProvider(window.ethereum);
            network = await provider.getNetwork();
        }

        if (network.chainId !== SEPOLIA_CHAIN_ID) {
            showStatus("Выбери сеть Sepolia в MetaMask.");
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
            "Кошелёк: " +
            playerAddress.slice(0, 6) +
            "..." +
            playerAddress.slice(-4);

        $("network").textContent = "Сеть: Sepolia";

        $("connectButton").textContent = "Кошелёк подключён";

        showStatus("Подключение успешно! Загружаю данные из блокчейна...");

        await refreshData();
    } catch (error) {
        showStatus("Ошибка подключения: " + formatError(error));
    }
}

async function refreshData() {
    if (!contract || !playerAddress) {
        showStatus("Сначала подключи MetaMask.");
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
            ? "🏆 Достижение открыто!"
            : "Достижение пока не открыто";

        lastWoodTime = Number(woodTime);
        lastStoneTime = Number(stoneTime);

        updateTimers();
        showStatus("Данные успешно загружены из блокчейна.");
    } catch (error) {
        showStatus("Не удалось прочитать данные: " + formatError(error));
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
        ? `Следующий сбор через ${woodRemaining} сек.`
        : "Можно собирать дерево";

    $("stoneTimer").textContent = stoneRemaining > 0
        ? `Следующий сбор через ${stoneRemaining} сек.`
        : "Можно собирать камень";

    $("woodButton").disabled =
        !contract || woodRemaining > 0;

    $("stoneButton").disabled =
        !contract || stoneRemaining > 0;

    $("craftButton").disabled = !contract;
}

async function sendTransaction(methodName, successMessage) {
    if (!contract) {
        showStatus("Сначала подключи MetaMask.");
        return;
    }

    const buttons = [
        $("woodButton"),
        $("stoneButton"),
        $("craftButton")
    ];

    buttons.forEach(button => button.disabled = true);

    try {
        showStatus("Подтверди транзакцию в MetaMask...");

        const tx = await contract[methodName]();

        showStatus("Транзакция отправлена. Ожидаю подтверждения...");

        await tx.wait();

        showStatus(successMessage);

        await refreshData();
    } catch (error) {
        showStatus("Ошибка: " + formatError(error));
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