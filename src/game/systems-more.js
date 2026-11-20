/**
 * Weitere Spielsysteme für deutlich mehr Funktionen pro Spiel:
 *  - FishingService:     Angelplätze mit ProximityPrompt, seltene Fänge, Crafting-Material
 *  - CraftingService:    Rezepte aus Material + Coins, permanente Spielerboni
 *  - GuildService:       Gilden gründen, beitreten, spenden, Gilden-Level
 *  - SeasonPassService:  Season-Pass mit Stufen, XP aus verdienten Coins, Belohnungen
 *  - DialogueService:    Dialog-NPCs mit Gesprächsverlauf und einmaliger Belohnung
 *
 * Alle Module sind eigenständig, greifen defensiv auf leaderstats zu und erzeugen
 * fehlende Remotes selbst. Sie laufen damit auch in projektspezifischen Varianten.
 */

export function fishingServiceModule(spec, config) {
  const spots = Math.max(2, Math.min(6, (config?.shops?.length || 3)));
  return `-- FishingService: ${spots} Angelplätze, seltene Fänge und Material für das Crafting
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Workspace = game:GetService("Workspace")

local remotes = ReplicatedStorage:WaitForChild("Remotes")
local notify = remotes:FindFirstChild("Notify")
local catchEvent = remotes:FindFirstChild("FishingCatch")
if not catchEvent then
	catchEvent = Instance.new("RemoteEvent")
	catchEvent.Name = "FishingCatch"
	catchEvent.Parent = remotes
end

local FISH = {
	{ name = "Silberfisch", rarity = "häufig", weight = 40, coins = 30, material = "Schuppen", amount = 1 },
	{ name = "Goldforelle", rarity = "häufig", weight = 28, coins = 55, material = "Schuppen", amount = 2 },
	{ name = "Blaulachs", rarity = "selten", weight = 16, coins = 120, material = "Kristall", amount = 1 },
	{ name = "Regenbogen-Koi", rarity = "selten", weight = 9, coins = 240, material = "Kristall", amount = 2 },
	{ name = "Schattenhai", rarity = "episch", weight = 5, coins = 600, material = "Kristall", amount = 3 },
	{ name = "Uralter Leviathan", rarity = "legendär", weight = 2, coins = 2000, material = "Perle", amount = 1 },
}

local COOLDOWN = 1.5
local lastCast = {}

local function coinsValue(player)
	local stats = player:FindFirstChild("leaderstats")
	local coins = stats and stats:FindFirstChild("Coins")
	return coins and coins.Value or 0
end

local function addCoins(player, amount)
	local stats = player:FindFirstChild("leaderstats")
	local coins = stats and stats:FindFirstChild("Coins")
	if coins then
		coins.Value = coins.Value + amount
	end
end

local function addMaterial(player, material, amount)
	local key = "Mat_" .. material
	local current = player:GetAttribute(key) or 0
	player:SetAttribute(key, current + amount)
end

local function roll()
	local total = 0
	for _, fish in ipairs(FISH) do
		total = total + fish.weight
	end
	local pick = math.random() * total
	local running = 0
	for _, fish in ipairs(FISH) do
		running = running + fish.weight
		if pick <= running then
			return fish
		end
	end
	return FISH[1]
end

local function cast(player)
	if not player or not player.Parent then
		return
	end
	local now = os.clock()
	if lastCast[player.UserId] and now - lastCast[player.UserId] < COOLDOWN then
		return
	end
	lastCast[player.UserId] = now

	local fish = roll()
	addCoins(player, fish.coins)
	addMaterial(player, fish.material, fish.amount)
	catchEvent:FireClient(player, {
		fish = fish.name,
		rarity = fish.rarity,
		coins = fish.coins,
		material = fish.material,
		amount = fish.amount,
		totalCoins = coinsValue(player),
	})
	if notify then
		notify:FireClient(player, string.format("%s gefangen (%s) +%d Coins, +%d %s", fish.name, fish.rarity, fish.coins, fish.amount, fish.material))
	end
end

local function bind(prompt)
	if prompt:GetAttribute("FishingBound") then
		return
	end
	prompt:SetAttribute("FishingBound", true)
	prompt.Triggered:Connect(function(player)
		cast(player)
	end)
end

local function scan()
	for _, descendant in ipairs(Workspace:GetDescendants()) do
		if descendant:IsA("ProximityPrompt") and descendant.ObjectText == "Angelplatz" then
			bind(descendant)
		end
	end
end

scan()
Workspace.DescendantAdded:Connect(function(descendant)
	if descendant:IsA("ProximityPrompt") and descendant.ObjectText == "Angelplatz" then
		bind(descendant)
	end
end)

Players.PlayerRemoving:Connect(function(player)
	lastCast[player.UserId] = nil
end)

print("[FishingService] Angelplätze aktiv")
`;
}

export function craftingServiceModule(spec, config) {
  const shopHint = (config?.shops || []).slice(0, 2).map((s) => s.name).join(' / ') || 'Shop';
  return `-- CraftingService: Rezepte aus Material und Coins (Material kommt u. a. vom Angeln)
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Workspace = game:GetService("Workspace")

local remotes = ReplicatedStorage:WaitForChild("Remotes")
local notify = remotes:FindFirstChild("Notify")
local craftEvent = remotes:FindFirstChild("CraftRequest")
if not craftEvent then
	craftEvent = Instance.new("RemoteEvent")
	craftEvent.Name = "CraftRequest"
	craftEvent.Parent = remotes
end
local craftResult = remotes:FindFirstChild("CraftResult")
if not craftResult then
	craftResult = Instance.new("RemoteEvent")
	craftResult.Name = "CraftResult"
	craftResult.Parent = remotes
end

-- Rezepte: Material stammt aus Angeln und Sammelstellen, Coins aus dem Spiel selbst.
local RECIPES = {
	{ id = "stiefel", name = "Schnelle Stiefel", coins = 150, material = "Schuppen", amount = 5, bonus = "Speed", value = 4 },
	{ id = "beutel", name = "Großer Beutel", coins = 250, material = "Schuppen", amount = 9, bonus = "Capacity", value = 50 },
	{ id = "rute", name = "Goldene Rute", coins = 400, material = "Kristall", amount = 3, bonus = "Luck", value = 0.15 },
	{ id = "amulett", name = "Glücksamulett", coins = 600, material = "Kristall", amount = 5, bonus = "CoinBonus", value = 0.2 },
	{ id = "krone", name = "Leviathan-Krone", coins = 1500, material = "Perle", amount = 1, bonus = "Prestige", value = 1 },
}

local function coinsOf(player)
	local stats = player:FindFirstChild("leaderstats")
	local coins = stats and stats:FindFirstChild("Coins")
	return coins
end

local function materialOf(player, material)
	return player:GetAttribute("Mat_" .. material) or 0
end

local function findRecipe(id)
	for _, recipe in ipairs(RECIPES) do
		if recipe.id == id then
			return recipe
		end
	end
	return nil
end

local function describe(player)
	local list = {}
	for _, recipe in ipairs(RECIPES) do
		local owned = materialOf(player, recipe.material)
		table.insert(list, {
			id = recipe.id,
			name = recipe.name,
			coins = recipe.coins,
			material = recipe.material,
			amount = recipe.amount,
			owned = owned,
			craftable = owned >= recipe.amount and coinsOf(player) and coinsOf(player).Value >= recipe.coins,
			bonus = recipe.bonus,
		})
	end
	return list
end

craftEvent.OnServerEvent:Connect(function(player, id)
	local recipe = findRecipe(id)
	if not recipe then
		craftResult:FireClient(player, { ok = false, message = "Unbekanntes Rezept" })
		return
	end
	local coins = coinsOf(player)
	local owned = materialOf(player, recipe.material)
	if not coins or coins.Value < recipe.coins then
		craftResult:FireClient(player, { ok = false, message = string.format("Dir fehlen Coins (%d nötig)", recipe.coins) })
		return
	end
	if owned < recipe.amount then
		craftResult:FireClient(player, { ok = false, message = string.format("Dir fehlen %d %s (Angeln hilft)", recipe.amount - owned, recipe.material) })
		return
	end

	coins.Value = coins.Value - recipe.coins
	player:SetAttribute("Mat_" .. recipe.material, owned - recipe.amount)
	player:SetAttribute("Craft_" .. recipe.bonus, (player:GetAttribute("Craft_" .. recipe.bonus) or 0) + recipe.value)
	craftResult:FireClient(player, { ok = true, message = string.format("%s gebaut! Bonus %s +%s", recipe.name, recipe.bonus, tostring(recipe.value)), recipes = describe(player) })
	if notify then
		notify:FireClient(player, string.format("%s hergestellt – dauerhafter Bonus %s", recipe.name, recipe.bonus))
	end
end)

local function bind(prompt)
	if prompt:GetAttribute("CraftBound") then
		return
	end
	prompt:SetAttribute("CraftBound", true)
	prompt.Triggered:Connect(function(player)
		craftResult:FireClient(player, { ok = true, message = "Werkbank geöffnet (" .. "${shopHint}" .. ")", recipes = describe(player), open = true })
	end)
end

local function scan()
	for _, descendant in ipairs(Workspace:GetDescendants()) do
		if descendant:IsA("ProximityPrompt") and descendant.ObjectText == "Werkbank" then
			bind(descendant)
		end
	end
end

scan()
Workspace.DescendantAdded:Connect(function(descendant)
	if descendant:IsA("ProximityPrompt") and descendant.ObjectText == "Werkbank" then
		bind(descendant)
	end
end)

Players.PlayerAdded:Connect(function(player)
	task.wait(2)
	craftResult:FireClient(player, { ok = true, message = "Rezepte geladen", recipes = describe(player) })
end)

print("[CraftingService] ${RECIPES_HINT} Rezepte aktiv".gsub and "" or "")
`;
}

export function guildServiceModule(spec, config) {
  return `-- GuildService: Gilden gründen, beitreten, spenden und im Gilden-Level aufsteigen
local Players = game:GetService("Players")
local DataStoreService = game:GetService("DataStoreService")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local remotes = ReplicatedStorage:WaitForChild("Remotes")
local notify = remotes:FindFirstChild("Notify")
local guildEvent = remotes:FindFirstChild("GuildAction")
if not guildEvent then
	guildEvent = Instance.new("RemoteEvent")
	guildEvent.Name = "GuildAction"
	guildEvent.Parent = remotes
end
local guildState = remotes:FindFirstChild("GuildState")
if not guildState then
	guildState = Instance.new("RemoteEvent")
	guildState.Name = "GuildState"
	guildState.Parent = remotes
end

local store = nil
pcall(function()
	store = DataStoreService:GetDataStore("GuildsV1")
end)

local MAX_MEMBERS = 20
local guilds = {}
local membership = {}

local function coinsOf(player)
	local stats = player:FindFirstChild("leaderstats")
	local coins = stats and stats:FindFirstChild("Coins")
	return coins
end

local function levelOf(guild)
	return math.floor(math.sqrt((guild.points or 0) / 500)) + 1
end

local function snapshot(guild)
	if not guild then
		return nil
	end
	return {
		name = guild.name,
		owner = guild.owner,
		members = #guild.members,
		points = guild.points,
		level = levelOf(guild),
		bonus = math.min(0.5, levelOf(guild) * 0.02),
	}
end

local function sendState(player)
	local guild = guilds[membership[player.UserId]]
	local list = {}
	for _, guild in pairs(guilds) do
		table.insert(list, snapshot(guild))
	end
	table.sort(list, function(a, b)
		return a.points > b.points
	end)
	guildState:FireClient(player, { mine = snapshot(guild), guilds = list, maxMembers = MAX_MEMBERS })
end

local function reply(player, text)
	if notify then
		notify:FireClient(player, text)
	end
end

local function create(player, name)
	if membership[player.UserId] then
		reply(player, "Du bist schon in einer Gilde")
		return
	end
	if typeof(name) ~= "string" or #name < 3 or #name > 20 then
		reply(player, "Gildenname muss 3 bis 20 Zeichen haben")
		return
	end
	if guilds[name] then
		reply(player, "Diesen Gildennamen gibt es schon")
		return
	end
	guilds[name] = { name = name, owner = player.UserId, members = { player.UserId }, points = 0 }
	membership[player.UserId] = name
	reply(player, "Gilde " .. name .. " gegründet – lade Freunde ein")
	sendState(player)
end

local function join(player, name)
	local guild = guilds[name]
	if not guild then
		reply(player, "Gilde nicht gefunden")
		return
	end
	if #guild.members >= MAX_MEMBERS then
		reply(player, "Diese Gilde ist voll")
		return
	end
	if membership[player.UserId] == name then
		return
	end
	if membership[player.UserId] then
		local old = guilds[membership[player.UserId]]
		if old then
			for index, userId in ipairs(old.members) do
				if userId == player.UserId then
					table.remove(old.members, index)
					break
				end
			end
		end
	end
	table.insert(guild.members, player.UserId)
	membership[player.UserId] = name
	reply(player, "Du bist jetzt Mitglied von " .. name)
	sendState(player)
end

local function donate(player, amount)
	local guild = guilds[membership[player.UserId]]
	if not guild then
		reply(player, "Du bist in keiner Gilde")
		return
	end
	local coins = coinsOf(player)
	amount = math.floor(tonumber(amount) or 0)
	if not coins or amount <= 0 or coins.Value < amount then
		reply(player, "Spende nicht möglich")
		return
	end
	coins.Value = coins.Value - amount
	guild.points = guild.points + amount
	player:SetAttribute("GuildBonus", math.min(0.5, levelOf(guild) * 0.02))
	reply(player, string.format("Gilde %s: %d Punkte, Level %d (+%d%% Coins)", guild.name, guild.points, levelOf(guild), math.floor(levelOf(guild) * 2)))
	sendState(player)
end

guildEvent.OnServerEvent:Connect(function(player, action, value)
	if action == "create" then
		create(player, value)
	elseif action == "join" then
		join(player, value)
	elseif action == "donate" then
		donate(player, value)
	elseif action == "state" then
		sendState(player)
	end
end)

local function save()
	if not store then
		return
	end
	local flat = {}
	for name, guild in pairs(guilds) do
		flat[name] = { owner = guild.owner, members = guild.members, points = guild.points }
	end
	pcall(function()
		store:SetAsync("guilds", flat)
	end)
end

local function load()
	if not store then
		return
	end
	local ok, result = pcall(function()
		return store:GetAsync("guilds")
	end)
	if ok and typeof(result) == "table" then
		for name, data in pairs(result) do
			guilds[name] = { name = name, owner = data.owner, members = data.members or {}, points = data.points or 0 }
			for _, userId in ipairs(data.members or {}) do
				membership[userId] = name
			end
		end
	end
end

load()

Players.PlayerAdded:Connect(function(player)
	task.wait(3)
	sendState(player)
end)

while true do
	task.wait(120)
	save()
end
`;
}

export function seasonPassServiceModule(spec, config) {
  return `-- SeasonPassService: Season-Pass mit 20 Stufen, XP aus verdienten Coins
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local remotes = ReplicatedStorage:WaitForChild("Remotes")
local notify = remotes:FindFirstChild("Notify")
local claimEvent = remotes:FindFirstChild("SeasonClaim")
if not claimEvent then
	claimEvent = Instance.new("RemoteEvent")
	claimEvent.Name = "SeasonClaim"
	claimEvent.Parent = remotes
end
local stateEvent = remotes:FindFirstChild("SeasonState")
if not stateEvent then
	stateEvent = Instance.new("RemoteEvent")
	stateEvent.Name = "SeasonState"
	stateEvent.Parent = remotes
end

local XP_PER_TIER = 250
local MAX_TIER = 20
local TIERS = {}
for tier = 1, MAX_TIER do
	TIERS[tier] = {
		tier = tier,
		reward = 150 + tier * 120,
		label = tier % 5 == 0 and "Große Belohnung" or "Belohnung",
	}
end

local progress = {}

local function coinsOf(player)
	local stats = player:FindFirstChild("leaderstats")
	local coins = stats and stats:FindFirstChild("Coins")
	return coins
end

local function state(player)
	local data = progress[player.UserId]
	if not data then
		return { tier = 0, xp = 0, next = XP_PER_TIER, claimed = {}, maxTier = MAX_TIER }
	end
	local tier = math.min(MAX_TIER, math.floor(data.xp / XP_PER_TIER))
	return {
		tier = tier,
		xp = data.xp,
		next = XP_PER_TIER - (data.xp % XP_PER_TIER),
		claimed = data.claimed,
		maxTier = MAX_TIER,
		tiers = TIERS,
	}
end

local function push(player)
	stateEvent:FireClient(player, state(player))
end

local function track(player)
	local data = progress[player.UserId]
	if not data then
		return
	end
	local coins = coinsOf(player)
	if not coins then
		return
	end
	local value = coins.Value
	if data.lastCoins == nil then
		data.lastCoins = value
		return
	end
	if value > data.lastCoins then
		local gained = value - data.lastCoins
		data.xp = data.xp + gained
	end
	data.lastCoins = value
	local tier = math.min(MAX_TIER, math.floor(data.xp / XP_PER_TIER))
	if tier > data.shownTier then
		data.shownTier = tier
		if notify then
			notify:FireClient(player, string.format("Season-Pass Stufe %d erreicht – Belohnung abholbar", tier))
		end
		push(player)
	end
end

claimEvent.OnServerEvent:Connect(function(player, tier)
	local data = progress[player.UserId]
	if not data then
		return
	end
	tier = math.floor(tonumber(tier) or 0)
	local reached = math.min(MAX_TIER, math.floor(data.xp / XP_PER_TIER))
	if tier < 1 or tier > reached then
		if notify then
			notify:FireClient(player, "Diese Stufe ist noch nicht freigeschaltet")
		end
		return
	end
	if data.claimed[tier] then
		if notify then
			notify:FireClient(player, "Belohnung schon abgeholt")
		end
		return
	end
	data.claimed[tier] = true
	local reward = TIERS[tier].reward
	local coins = coinsOf(player)
	if coins then
		coins.Value = coins.Value + reward
	end
	if notify then
		notify:FireClient(player, string.format("Season-Pass Stufe %d: +%d Coins", tier, reward))
	end
	push(player)
end)

Players.PlayerAdded:Connect(function(player)
	progress[player.UserId] = { xp = 0, claimed = {}, shownTier = 0, lastCoins = nil }
	task.wait(2)
	push(player)
end)

Players.PlayerRemoving:Connect(function(player)
	progress[player.UserId] = nil
end)

while true do
	task.wait(2)
	for _, player in ipairs(Players:GetPlayers()) do
		track(player)
	end
end
`;
}

export function dialogueServiceModule(spec, config) {
  const npcs = (config?.npcs || []).slice(0, 4);
  const lines = npcs.length
    ? npcs.map((npc, index) => `\t{ name = ${JSON.stringify(npc.name || `Bewohner ${index + 1}`)}, greeting = ${JSON.stringify((npc.dialog && npc.dialog[0]) || `Willkommen, ich bin ${npc.name || 'Bewohner'}.`)}, hint = ${JSON.stringify(`Sammle Coins bei ${npc.zone || 'der Plaza'}`)}, reward = ${80 + index * 40} },`).join('\n')
    : '\t{ name = "Plaza-Wächter", greeting = "Willkommen auf der Plaza!", hint = "Sammle zuerst Coins.", reward = 80 },';
  return `-- DialogueService: sprechende NPCs mit Tipp und einmaliger Belohnung
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Workspace = game:GetService("Workspace")

local remotes = ReplicatedStorage:WaitForChild("Remotes")
local notify = remotes:FindFirstChild("Notify")
local dialogEvent = remotes:FindFirstChild("Dialog")
if not dialogEvent then
	dialogEvent = Instance.new("RemoteEvent")
	dialogEvent.Name = "Dialog"
	dialogEvent.Parent = remotes
end

local DIALOGUES = {
${lines}
}

local greeted = {}

local function coinsOf(player)
	local stats = player:FindFirstChild("leaderstats")
	local coins = stats and stats:FindFirstChild("Coins")
	return coins
end

local function talk(player, index)
	local entry = DIALOGUES[index] or DIALOGUES[1]
	local key = player.UserId .. "_" .. tostring(index)
	local firstTime = not greeted[key]
	greeted[key] = true
	local reward = 0
	if firstTime then
		reward = entry.reward
		local coins = coinsOf(player)
		if coins then
			coins.Value = coins.Value + reward
		end
	end
	dialogEvent:FireClient(player, {
		name = entry.name,
		greeting = entry.greeting,
		hint = entry.hint,
		reward = reward,
		firstTime = firstTime,
	})
	if notify then
		notify:FireClient(player, entry.name .. ": " .. entry.greeting)
	end
end

local function bind(prompt, index)
	if prompt:GetAttribute("DialogBound") then
		return
	end
	prompt:SetAttribute("DialogBound", true)
	prompt.Triggered:Connect(function(player)
		talk(player, index)
	end)
end

local function scan()
	local index = 0
	for _, descendant in ipairs(Workspace:GetDescendants()) do
		if descendant:IsA("ProximityPrompt") and descendant.ObjectText == "Gespräch" then
			index = index + 1
			bind(descendant, index)
		end
	end
end

scan()
Workspace.DescendantAdded:Connect(function(descendant)
	if descendant:IsA("ProximityPrompt") and descendant.ObjectText == "Gespräch" then
		bind(descendant, math.random(1, #DIALOGUES))
	end
end)

Players.PlayerRemoving:Connect(function(player)
	for key in pairs(greeted) do
		if tostring(key):sub(1, #tostring(player.UserId)) == tostring(player.UserId) then
			greeted[key] = nil
		end
	end
end

print("[DialogueService] " .. tostring(#DIALOGUES) .. " Dialog-NPCs aktiv")
`;
}

/** IDs der neuen Systeme – werden in Katalog, Report und UI verwendet. */
export const MORE_SYSTEM_IDS = ['fishing', 'crafting', 'guilds', 'seasonpass', 'dialogue'];
