/**
 * Zusätzliche Spielsysteme, die jedes erzeugte Spiel besser spielbar machen:
 *  - LeaderboardService: globale Bestenliste mit sichtbarer Tafel in der Welt
 *  - TutorialService: geführter Einstieg in fünf Schritten
 *
 * Beide Skripte sind eigenständig (nur Standard-Dienste) und greifen defensiv auf
 * leaderstats zu, damit sie auch in projektspezifischen Varianten laufen.
 */

export function leaderboardServiceModule() {
  return `-- LeaderboardService: globale Coins-Bestenliste mit Anzeigetafel in der Welt
local DataStoreService = game:GetService("DataStoreService")
local Players = game:GetService("Players")
local Workspace = game:GetService("Workspace")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local store = nil
pcall(function()
	store = DataStoreService:GetDataStore("GlobalLeaderboardV1")
end)

local remotes = ReplicatedStorage:FindFirstChild("Remotes")
local updateEvent = nil
if remotes then
	updateEvent = remotes:FindFirstChild("LeaderboardUpdate")
	if not updateEvent then
		updateEvent = Instance.new("RemoteEvent")
		updateEvent.Name = "LeaderboardUpdate"
		updateEvent.Parent = remotes
	end
end

local MAX_ROWS = 8
local entries = {}
local rows = {}

local function coinsOf(player)
	local stats = player:FindFirstChild("leaderstats")
	local coins = stats and stats:FindFirstChild("Coins")
	if coins and typeof(coins.Value) == "number" then
		return coins.Value
	end
	return 0
end

local function buildBoard()
	local panel = Workspace:FindFirstChild("LeaderboardPanel", true)
	if not panel then
		return
	end
	local gui = panel:FindFirstChildOfClass("SurfaceGui")
	if not gui then
		gui = Instance.new("SurfaceGui")
		gui.Face = Enum.NormalId.Front
		gui.CanvasSize = Vector2.new(480, 280)
		gui.Parent = panel
	end
	local layout = gui:FindFirstChildOfClass("UIListLayout")
	if not layout then
		layout = Instance.new("UIListLayout")
		layout.Padding = UDim.new(0, 4)
		layout.SortOrder = Enum.SortOrder.LayoutOrder
		layout.Parent = gui
	end
	for index = 1, MAX_ROWS do
		local label = gui:FindFirstChild("Row" .. index)
		if not label then
			label = Instance.new("TextLabel")
			label.Name = "Row" .. index
			label.LayoutOrder = index
			label.Size = UDim2.new(1, 0, 0, 28)
			label.BackgroundTransparency = 1
			label.Font = Enum.Font.GothamBold
			label.TextColor3 = Color3.fromRGB(240, 236, 255)
			label.TextScaled = true
			label.TextXAlignment = Enum.TextXAlignment.Left
			label.Text = ""
			label.Parent = gui
		end
		rows[index] = label
	end
end

local function render()
	for index, label in ipairs(rows) do
		local entry = entries[index]
		if entry then
			label.Text = string.format("%d.  %s  -  %d Coins", index, entry.name, entry.coins)
		else
			label.Text = ""
		end
	end
	if updateEvent then
		updateEvent:FireAllClients(entries)
	end
end

local function sortEntries()
	table.sort(entries, function(a, b)
		return a.coins > b.coins
	end)
	while #entries > MAX_ROWS do
		table.remove(entries)
	end
end

local function submit(player)
	local coins = coinsOf(player)
	if coins <= 0 then
		return
	end
	local found = false
	for _, entry in ipairs(entries) do
		if entry.userId == player.UserId then
			entry.coins = math.max(entry.coins, coins)
			entry.name = player.Name
			found = true
		end
	end
	if not found then
		table.insert(entries, { userId = player.UserId, name = player.Name, coins = coins })
	end
	sortEntries()
	render()
end

local function loadBoard()
	if not store then
		return
	end
	local ok, result = pcall(function()
		return store:GetAsync("top")
	end)
	if ok and typeof(result) == "table" then
		entries = result
		sortEntries()
		render()
	end
end

local function saveBoard()
	if not store then
		return
	end
	pcall(function()
		store:SetAsync("top", entries)
	end)
end

buildBoard()
loadBoard()

Players.PlayerAdded:Connect(function(player)
	task.wait(3)
	submit(player)
end)

Players.PlayerRemoving:Connect(function(player)
	submit(player)
	saveBoard()
end)

while true do
	task.wait(30)
	for _, player in ipairs(Players:GetPlayers()) do
		submit(player)
	end
	saveBoard()
end
`;
}

export function tutorialServiceModule() {
  return `-- TutorialService: führt neue Spieler in fünf Schritten durch das Spiel
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local remotes = ReplicatedStorage:WaitForChild("Remotes")
local notify = remotes:FindFirstChild("Notify")
local stepEvent = remotes:FindFirstChild("TutorialStep")
if not stepEvent then
	stepEvent = Instance.new("RemoteEvent")
	stepEvent.Name = "TutorialStep"
	stepEvent.Parent = remotes
end

local STEPS = {
	{ goal = "Sieh dich auf der Plaza um", coins = 0 },
	{ goal = "Sammle 25 Coins", coins = 25 },
	{ goal = "Kaufe etwas im ersten Shop", coins = 60 },
	{ goal = "Sammle 150 Coins", coins = 150 },
	{ goal = "Erreiche Level 5", coins = 400 },
}

local progress = {}

local function coinsOf(player)
	local stats = player:FindFirstChild("leaderstats")
	local coins = stats and stats:FindFirstChild("Coins")
	return coins and coins.Value or 0
end

local function levelOf(player)
	local stats = player:FindFirstChild("leaderstats")
	local level = stats and stats:FindFirstChild("Level")
	return level and level.Value or 1
end

local function send(player, text)
	if notify then
		notify:FireClient(player, text)
	end
end

local function showStep(player, index)
	local state = progress[player.UserId]
	if not state then
		return
	end
	local step = STEPS[index]
	if not step then
		state.done = true
		stepEvent:FireClient(player, { index = index, total = #STEPS, goal = "Tutorial abgeschlossen", done = true })
		send(player, "Tutorial abgeschlossen - viel Erfolg!")
		return
	end
	state.index = index
	stepEvent:FireClient(player, { index = index, total = #STEPS, goal = step.goal, done = false })
	send(player, string.format("Ziel %d/%d: %s", index, #STEPS, step.goal))
end

local function check(player)
	local state = progress[player.UserId]
	if not state or state.done then
		return
	end
	local step = STEPS[state.index]
	if not step then
		return
	end
	local reached = false
	if state.index == 5 then
		reached = levelOf(player) >= 5
	elseif step.coins > 0 then
		reached = coinsOf(player) >= step.coins
	end
	if reached then
		showStep(player, state.index + 1)
	end
end

Players.PlayerAdded:Connect(function(player)
	progress[player.UserId] = { index = 1, done = false }
	task.wait(2)
	showStep(player, 1)
end)

Players.PlayerRemoving:Connect(function(player)
	progress[player.UserId] = nil
end)

while true do
	task.wait(2)
	for _, player in ipairs(Players:GetPlayers()) do
		check(player)
	end
end
`;
}
