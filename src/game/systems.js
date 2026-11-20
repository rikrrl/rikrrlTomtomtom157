/**
 * Zusätzliche Luau-Systeme für generierte Spiele.
 *
 * Jedes Modul ist eigenständig und defensiv geschrieben (pcall / FindFirstChild),
 * damit ein Projekt auch dann startet, wenn einzelne Properties beim Serialisieren
 * fehlen. Die Module greifen auf GameConfig (ReplicatedStorage/Shared) und die
 * RemoteEvents in ReplicatedStorage/Remotes zu, die der Generator anlegt.
 */

import { toLua } from './lua.js';

/** Katalog der verfügbaren Systeme (auch für die Anzeige im Web-UI). */
export const SYSTEM_CATALOG = {
  quests: { id: 'quests', label: 'Quest-Ketten', script: 'QuestService', description: 'Mehrstufige Aufträge mit Fortschritt und Belohnungen.' },
  achievements: { id: 'achievements', label: 'Erfolge', script: 'AchievementService', description: 'Freischaltbare Erfolge mit Benachrichtigung.' },
  talents: { id: 'talents', label: 'Talentbaum', script: 'TalentService', description: 'Dauerhafte Verbesserungen, die man mit Coins kauft.' },
  daily: { id: 'daily', label: 'Tagesbelohnung', script: 'DailyRewardService', description: '7-Tage-Streak mit steigenden Belohnungen.' },
  trading: { id: 'trading', label: 'Handel', script: 'TradeService', description: 'Coins und Pets zwischen Spielern tauschen.' },
  boss: { id: 'boss', label: 'Bosskampf', script: 'BossService', description: 'Endgegner mit HP, Phasen und Beute.' },
  weather: { id: 'weather', label: 'Tag/Nacht & Wetter', script: 'DayNightCycle', description: 'Dynamische Beleuchtung und Wetterstimmung.' },
  wordgame: { id: 'wordgame', label: 'Wortspiel-Runden', script: 'WordGameService', description: 'Wörter raten, Punkte, Hinweise und Buzz.' },
  anticheat: { id: 'anticheat', label: 'Anti-Cheat', script: 'AntiCheat', description: 'Prüft Coin- und Kaufanfragen serverseitig.' },
};

const header = (spec, title) => `--!nocheck
-- ${title}: automatisch erzeugt von Roblox AI Studio für "${spec.title}"
-- Genre: ${spec.genre} · Qualität: ${spec.quality || 'grundlich'}
`;

/** Gemeinsamer Kopf: Services, Config, Remote-Helfer. */
const commonHead = () => `local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Shared = ReplicatedStorage:WaitForChild("Shared")
local Config = require(Shared:WaitForChild("GameConfig"))

local Remotes = ReplicatedStorage:FindFirstChild("Remotes")
local function remote(name)
	if not Remotes then return nil end
	return Remotes:FindFirstChild(name)
end

local function notify(player, text, color)
	local event = remote("Notify")
	if event and player then
		event:FireClient(player, text, color or Color3.fromRGB(140, 110, 255))
	end
end
`;

/** Mehrstufige Quest-Ketten mit Fortschritt, Belohnungen und Kettenabschluss. */
export function questServiceModule(spec, config) {
  return `${header(spec, 'QuestService')}${commonHead()}
local QuestService = {}
local chains = Config.questChains or {}

local state = {}

local function ensure(player)
	if not state[player.UserId] then
		state[player.UserId] = { chain = 1, stage = 1, progress = 0, completed = {} }
	end
	return state[player.UserId]
end

local function currentQuest(data)
	local chain = chains[data.chain]
	if not chain then return nil end
	return chain.stages and chain.stages[data.stage]
end

local function reward(player, quest)
	local event = remote("QuestReward")
	local coins = quest.reward or 100
	local xp = quest.xp or 50
	if event then
		event:FireClient(player, { coins = coins, xp = xp, questId = quest.id })
	else
		notify(player, string.format("Quest abgeschlossen: +%d Coins", coins))
	end
end

function QuestService.Progress(player, kind, amount)
	local data = ensure(player)
	local quest = currentQuest(data)
	if not quest then return end
	if quest.kind ~= kind then return end
	data.progress = data.progress + (amount or 1)
	local event = remote("QuestProgress")
	if event then
		event:FireClient(player, {
			questId = quest.id,
			name = quest.name,
			progress = math.min(data.progress, quest.goal),
			goal = quest.goal,
			chain = data.chain,
			stage = data.stage,
		})
	end
	if data.progress >= quest.goal then
		reward(player, quest)
		data.completed[quest.id] = true
		local chain = chains[data.chain]
		if chain and chain.stages and chain.stages[data.stage + 1] then
			data.stage = data.stage + 1
			data.progress = 0
			notify(player, "Neue Quest: " .. tostring(chain.stages[data.stage].name), Color3.fromRGB(120, 220, 255))
		else
			data.chain = data.chain + 1
			data.stage = 1
			data.progress = 0
			if chains[data.chain] then
				notify(player, "Neue Quest-Kette: " .. tostring(chains[data.chain].name), Color3.fromRGB(255, 210, 120))
			else
				notify(player, "Alle Quest-Ketten abgeschlossen!", Color3.fromRGB(255, 210, 120))
			end
		end
	end
end

function QuestService.GetState(player)
	local data = ensure(player)
	local quest = currentQuest(data)
	return {
		chain = data.chain,
		stage = data.stage,
		progress = data.progress,
		goal = quest and quest.goal or 0,
		name = quest and quest.name or "Abgeschlossen",
		description = quest and quest.description or "",
	}
end

Players.PlayerAdded:Connect(function(player)
	task.wait(2)
	ensure(player)
	local snapshot = QuestService.GetState(player)
	local event = remote("QuestState")
	if event then event:FireClient(player, snapshot) end
end)

Players.PlayerRemoving:Connect(function(player)
	state[player.UserId] = nil
end)

_G.QuestService = QuestService
return QuestService
`;
}

/** Erfolge mit selteneren Meilensteinen und Benachrichtigung. */
export function achievementServiceModule(spec, config) {
  const achievements = [
    { id: 'first_coin', name: 'Erster Fund', description: 'Sammle deine erste Münze.', goal: 1, kind: 'coins' },
    { id: 'coins_100', name: 'Sparfuchs', description: 'Sammle 100 Münzen.', goal: 100, kind: 'coins' },
    { id: 'coins_1000', name: 'Reich geworden', description: 'Sammle 1.000 Münzen.', goal: 1000, kind: 'coins' },
    { id: 'level_5', name: 'Aufsteiger', description: 'Erreiche Level 5.', goal: 5, kind: 'level' },
    { id: 'level_15', name: 'Veteran', description: 'Erreiche Level 15.', goal: 15, kind: 'level' },
    { id: 'shop_1', name: 'Erster Einkauf', description: 'Kaufe deinen ersten Artikel.', goal: 1, kind: 'purchases' },
    { id: 'shop_10', name: 'Stammkunde', description: 'Kaufe 10 Artikel.', goal: 10, kind: 'purchases' },
    { id: 'pet_1', name: 'Tierfreund', description: 'Rüste dein erstes Pet aus.', goal: 1, kind: 'pets' },
    { id: 'pet_3', name: 'Pet-Sammler', description: 'Sammle 3 verschiedene Pets.', goal: 3, kind: 'pets' },
    { id: 'zone_3', name: 'Entdecker', description: 'Besuche 3 Zonen.', goal: 3, kind: 'zones' },
    { id: 'rebirth_1', name: 'Neuanfang', description: 'Führe deinen ersten Rebirth durch.', goal: 1, kind: 'rebirths' },
    { id: 'quest_3', name: 'Auftragsläufer', description: 'Schließe 3 Quests ab.', goal: 3, kind: 'quests' },
  ];
  return `${header(spec, 'AchievementService')}${commonHead()}
local AchievementService = {}
local definitions = ${toLua(achievements, 0)}
local data = {}

local function ensure(player)
	if not data[player.UserId] then
		data[player.UserId] = { counters = {}, unlocked = {} }
	end
	return data[player.UserId]
end

function AchievementService.Add(player, kind, amount)
	local store = ensure(player)
	store.counters[kind] = (store.counters[kind] or 0) + (amount or 1)
	for _, definition in ipairs(definitions) do
		if definition.kind == kind and not store.unlocked[definition.id] then
			if store.counters[kind] >= definition.goal then
				store.unlocked[definition.id] = true
				notify(player, "Erfolg freigeschaltet: " .. definition.name, Color3.fromRGB(255, 210, 120))
				local event = remote("AchievementUnlocked")
				if event then
					event:FireClient(player, { id = definition.id, name = definition.name, description = definition.description })
				end
			end
		end
	end
end

function AchievementService.GetAll(player)
	local store = ensure(player)
	local list = {}
	for _, definition in ipairs(definitions) do
		table.insert(list, {
			id = definition.id,
			name = definition.name,
			description = definition.description,
			goal = definition.goal,
			progress = math.min(store.counters[definition.kind] or 0, definition.goal),
			unlocked = store.unlocked[definition.id] == true,
		})
	end
	return list
end

function AchievementService.Count(player)
	local store = ensure(player)
	local n = 0
	for _ in pairs(store.unlocked) do n = n + 1 end
	return n
end

Players.PlayerRemoving:Connect(function(player)
	data[player.UserId] = nil
end)

_G.AchievementService = AchievementService
return AchievementService
`;
}

/** Talentbaum: dauerhafte Verbesserungen, die mit Coins gekauft werden. */
export function talentServiceModule(spec, config) {
  return `${header(spec, 'TalentService')}${commonHead()}
local TalentService = {}
local talents = Config.talents or {}
local owned = {}

local function ensure(player)
	if not owned[player.UserId] then owned[player.UserId] = {} end
	return owned[player.UserId]
end

function TalentService.GetAll(player)
	local store = ensure(player)
	local list = {}
	for _, talent in ipairs(talents) do
		table.insert(list, {
			id = talent.id,
			name = talent.name,
			description = talent.description,
			cost = talent.cost,
			tier = talent.tier,
			owned = store[talent.id] == true,
		})
	end
	return list
end

function TalentService.Buy(player, talentId)
	local store = ensure(player)
	if store[talentId] then
		notify(player, "Talent ist bereits freigeschaltet.", Color3.fromRGB(255, 160, 120))
		return false
	end
	local talent = nil
	for _, entry in ipairs(talents) do
		if entry.id == talentId then talent = entry break end
	end
	if not talent then
		notify(player, "Unbekanntes Talent.", Color3.fromRGB(255, 160, 120))
		return false
	end
	local event = remote("BuyTalent")
	if event then
		event:FireServer(talentId)
	else
		notify(player, "Talent-Shop nicht verfügbar.", Color3.fromRGB(255, 160, 120))
		return false
	end
	return true
end

function TalentService.Confirm(player, talentId)
	local store = ensure(player)
	store[talentId] = true
	notify(player, "Talent freigeschaltet: " .. tostring(talentId), Color3.fromRGB(140, 255, 200))
end

function TalentService.Multiplier(player)
	local store = ensure(player)
	local multiplier = 1
	for _, talent in ipairs(talents) do
		if store[talent.id] then
			multiplier = multiplier + (talent.bonus or 0.1)
		end
	end
	return multiplier
end

Players.PlayerRemoving:Connect(function(player)
	owned[player.UserId] = nil
end)

_G.TalentService = TalentService
return TalentService
`;
}

/** 7-Tage-Streak mit steigenden Belohnungen. */
export function dailyServiceModule(spec, config) {
  return `${header(spec, 'DailyRewardService')}${commonHead()}
local DailyRewardService = {}
local rewards = Config.dailyRewards or {}
local claims = {}

local function dayIndex()
	return math.floor(os.time() / 86400)
end

local function ensure(player)
	if not claims[player.UserId] then
		claims[player.UserId] = { lastDay = 0, streak = 0 }
	end
	return claims[player.UserId]
end

function DailyRewardService.Claim(player)
	local data = ensure(player)
	local today = dayIndex()
	if data.lastDay == today then
		notify(player, "Heute schon abgeholt – komm morgen wieder!", Color3.fromRGB(255, 190, 120))
		return nil
	end
	if data.lastDay == today - 1 then
		data.streak = data.streak + 1
	else
		data.streak = 1
	end
	data.lastDay = today
	local index = ((data.streak - 1) % math.max(1, #rewards)) + 1
	local reward = rewards[index] or { coins = 100, label = "Tagesbonus" }
	local event = remote("DailyReward")
	if event then
		event:FireClient(player, { streak = data.streak, coins = reward.coins, label = reward.label, index = index })
	else
		notify(player, string.format("%s: +%d Coins (Streak %d)", reward.label, reward.coins, data.streak))
	end
	return reward
end

function DailyRewardService.GetState(player)
	local data = ensure(player)
	return { streak = data.streak, lastDay = data.lastDay, canClaim = data.lastDay ~= dayIndex() }
end

Players.PlayerAdded:Connect(function(player)
	task.wait(3)
	local state = DailyRewardService.GetState(player)
	local event = remote("DailyState")
	if event then event:FireClient(player, state) end
end)

_G.DailyRewardService = DailyRewardService
return DailyRewardService
`;
}

/** Handel zwischen zwei Spielern: Coins gegen Pets. */
export function tradeServiceModule(spec, config) {
  return `${header(spec, 'TradeService')}${commonHead()}
local TradeService = {}
local requests = {}

function TradeService.Request(from, toName, offer)
	if from == nil then return false end
	local target = Players:FindFirstChild(tostring(toName))
	if not target or target == from then
		notify(from, "Spieler nicht gefunden.", Color3.fromRGB(255, 150, 130))
		return false
	end
	requests[target.UserId] = { from = from.UserId, offer = offer, at = os.time() }
	local event = remote("TradeRequest")
	if event then
		event:FireClient(target, { from = from.Name, offer = offer })
	end
	notify(from, "Handelsanfrage an " .. target.Name .. " gesendet.")
	return true
end

function TradeService.Accept(player, accept)
	local request = requests[player.UserId]
	if not request then
		notify(player, "Keine offene Handelsanfrage.", Color3.fromRGB(255, 150, 130))
		return false
	end
	local partner = Players:GetPlayerByUserId(request.from)
	requests[player.UserId] = nil
	if not partner then
		notify(player, "Der Handelspartner ist nicht mehr im Spiel.", Color3.fromRGB(255, 150, 130))
		return false
	end
	if not accept then
		notify(partner, player.Name .. " hat den Handel abgelehnt.", Color3.fromRGB(255, 150, 130))
		return false
	end
	local event = remote("TradeComplete")
	if event then
		event:FireClient(partner, { partner = player.Name, offer = request.offer })
		event:FireClient(player, { partner = partner.Name, offer = request.offer })
	end
	notify(partner, "Handel mit " .. player.Name .. " abgeschlossen.", Color3.fromRGB(140, 255, 200))
	notify(player, "Handel mit " .. partner.Name .. " abgeschlossen.", Color3.fromRGB(140, 255, 200))
	return true
end

function TradeService.Pending(player)
	return requests[player.UserId] ~= nil
end

Players.PlayerRemoving:Connect(function(player)
	requests[player.UserId] = nil
end)

_G.TradeService = TradeService
return TradeService
`;
}

/** Endgegner mit HP-Phasen, Angriffen und Beute. */
export function bossServiceModule(spec, config) {
  return `${header(spec, 'BossService')}${commonHead()}
local BossService = {}
local bosses = Config.bosses or {}
local active = {}

function BossService.Spawn(zoneIndex)
	local definition = bosses[zoneIndex]
	if not definition then return nil end
	local workspaceMap = workspace:FindFirstChild("Map")
	if not workspaceMap then return nil end
	local holder = workspaceMap:FindFirstChild("Bosses")
	if not holder then
		holder = Instance.new("Folder")
		holder.Name = "Bosses"
		holder.Parent = workspaceMap
	end
	local model = Instance.new("Model")
	model.Name = "Boss_" .. tostring(definition.id)
	local body = Instance.new("Part")
	body.Name = "Body"
	body.Size = Vector3.new(12, 16, 12)
	body.Anchored = true
	body.CanCollide = true
	body.Color = Color3.fromRGB(180, 70, 120)
	body.Material = Enum.Material.Neon
	body.Position = Vector3.new(0, 10, -60)
	body.Parent = model
	local light = Instance.new("PointLight")
	light.Brightness = 3
	light.Range = 40
	light.Color = Color3.fromRGB(255, 90, 140)
	light.Parent = body
	model.Parent = holder
	active[definition.id] = { hp = definition.hp or 1000, maxHp = definition.hp or 1000, alive = true, model = model }
	notify(nil, "Boss erschienen: " .. definition.name, Color3.fromRGB(255, 120, 160))
	return active[definition.id]
end

function BossService.Damage(bossId, amount)
	local boss = active[bossId]
	if not boss or not boss.alive then return false end
	boss.hp = boss.hp - (amount or 10)
	if boss.hp <= 0 then
		boss.alive = false
		if boss.model then boss.model:Destroy() end
		return true
	end
	return false
end

function BossService.GetState(bossId)
	local boss = active[bossId]
	if not boss then return nil end
	return { hp = boss.hp, maxHp = boss.maxHp, alive = boss.alive }
end

_G.BossService = BossService
return BossService
`;
}

/** Wortspiel-Logik: Wörterbuch, Runden, Punkte, Hinweise und Buzz. */
export function wordGameServiceModule(spec, config) {
  const words = [
    { word: 'ROBLOX', hint: 'Hier spielst du gerade.' },
    { word: 'KRISTALL', hint: 'Leuchtet und ist selten.' },
    { word: 'ABENTEUER', hint: 'Was du gerade erlebst.' },
    { word: 'SIMULATOR', hint: 'Sammeln, kaufen, aufsteigen.' },
    { word: 'HAUSTIER', hint: 'Begleiter mit Multiplikator.' },
    { word: 'TYCOON', hint: 'Fabrik und Produktion.' },
    { word: 'GALAXIE', hint: 'Sehr, sehr weit weg.' },
    { word: 'ZAUBER', hint: 'Magie in einem RPG.' },
    { word: 'INSEL', hint: 'Land im Wasser.' },
    { word: 'TURNIER', hint: 'Wettkampf mit Runden.' },
    { word: 'SCHATZ', hint: 'Versteckt und wertvoll.' },
    { word: 'DRACHE', hint: 'Fliegt und speit Feuer.' },
    { word: 'PORTAL', hint: 'Bringt dich woandershin.' },
    { word: 'STERN', hint: 'Leuchtet am Himmel.' },
    { word: 'FREUND', hint: 'Spielt mit dir.' },
    { word: 'SIEG', hint: 'Am Ende des Wettkampfs.' },
  ];
  return `${header(spec, 'WordGameService')}${commonHead()}
local WordGameService = {}
local dictionary = ${toLua(words, 0)}
local round = { index = 0, solved = 0, current = nil, startedAt = 0 }

local function pick()
	round.index = (round.index % #dictionary) + 1
	round.current = dictionary[round.index]
	round.startedAt = os.time()
	return round.current
end

function WordGameService.StartRound(player)
	local entry = pick()
	local scrambled = ""
	local letters = {}
	for i = 1, #entry.word do
		table.insert(letters, string.sub(entry.word, i, i))
	end
	for i = #letters, 2, -1 do
		local j = math.random(i)
		letters[i], letters[j] = letters[j], letters[i]
	end
	scrambled = table.concat(letters)
	local event = remote("WordRound")
	if event then
		event:FireClient(player, { scrambled = scrambled, hint = entry.hint, length = #entry.word, index = round.index })
	end
	notify(player, "Neue Wort-Runde: " .. scrambled .. " (" .. #entry.word .. " Buchstaben)", Color3.fromRGB(140, 200, 255))
	return scrambled
end

function WordGameService.Submit(player, guess)
	if not round.current then return false end
	local normalised = string.upper(tostring(guess or ""))
	if normalised == round.current.word then
		round.solved = round.solved + 1
		local points = 50 + #round.current.word * 10
		local event = remote("WordSolved")
		if event then
			event:FireClient(player, { word = round.current.word, points = points, solved = round.solved })
		end
		notify(player, string.format("Richtig! %s (+%d Punkte)", round.current.word, points), Color3.fromRGB(140, 255, 190))
		task.delay(3, function() WordGameService.StartRound(player) end)
		return true
	end
	local event = remote("WordWrong")
	if event then event:FireClient(player, { guess = normalised }) end
	notify(player, "Leider falsch – versuch es nochmal.", Color3.fromRGB(255, 160, 140))
	return false
end

function WordGameService.State()
	return { solved = round.solved, word = round.current and round.current.word or nil }
end

_G.WordGameService = WordGameService
return WordGameService
`;
}

/** Client-UI für das Wortspiel: Eingabefeld, Tastatur, Punkte, Hinweise. */
export function wordGameClientModule(spec, config) {
  return `${header(spec, 'WordGameUI')}local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local player = Players.LocalPlayer
local Remotes = ReplicatedStorage:WaitForChild("Remotes")

local gui = Instance.new("ScreenGui")
gui.Name = "WordGameUI"
gui.ResetOnSpawn = false
gui.Parent = player:WaitForChild("PlayerGui")

local frame = Instance.new("Frame")
frame.Size = UDim2.fromOffset(420, 260)
frame.Position = UDim2.new(0.5, -210, 0.5, -130)
frame.BackgroundColor3 = Color3.fromRGB(24, 22, 40)
frame.BackgroundTransparency = 0.08
frame.BorderSizePixel = 0
frame.Visible = false
frame.Parent = gui

local corner = Instance.new("UICorner")
corner.CornerRadius = UDim.new(0, 16)
corner.Parent = frame

local title = Instance.new("TextLabel")
title.Size = UDim2.new(1, -32, 0, 34)
title.Position = UDim2.fromOffset(16, 12)
title.BackgroundTransparency = 1
title.Font = Enum.Font.GothamBold
title.TextSize = 22
title.TextColor3 = Color3.fromRGB(180, 150, 255)
title.TextXAlignment = Enum.TextXAlignment.Left
title.Text = "Wortspiel"
title.Parent = frame

local scrambled = Instance.new("TextLabel")
scrambled.Size = UDim2.new(1, -32, 0, 46)
scrambled.Position = UDim2.fromOffset(16, 50)
scrambled.BackgroundTransparency = 1
scrambled.Font = Enum.Font.GothamBold
scrambled.TextSize = 32
scrambled.TextColor3 = Color3.fromRGB(255, 255, 255)
scrambled.Text = "…"
scrambled.Parent = frame

local hint = Instance.new("TextLabel")
hint.Size = UDim2.new(1, -32, 0, 24)
hint.Position = UDim2.fromOffset(16, 96)
hint.BackgroundTransparency = 1
hint.Font = Enum.Font.Gotham
hint.TextSize = 15
hint.TextColor3 = Color3.fromRGB(160, 160, 190)
hint.TextXAlignment = Enum.TextXAlignment.Left
hint.Text = ""
hint.Parent = frame

local box = Instance.new("TextBox")
box.Size = UDim2.new(1, -140, 0, 42)
box.Position = UDim2.fromOffset(16, 132)
box.BackgroundColor3 = Color3.fromRGB(40, 36, 64)
box.BorderSizePixel = 0
box.Font = Enum.Font.GothamBold
box.TextSize = 20
box.TextColor3 = Color3.fromRGB(255, 255, 255)
box.PlaceholderText = "Lösung eingeben …"
box.Text = ""
box.ClearTextOnFocus = false
box.Parent = frame

local submit = Instance.new("TextButton")
submit.Size = UDim2.fromOffset(108, 42)
submit.Position = UDim2.new(1, -124, 0, 132)
submit.BackgroundColor3 = Color3.fromRGB(124, 92, 255)
submit.BorderSizePixel = 0
submit.Font = Enum.Font.GothamBold
submit.TextSize = 18
submit.TextColor3 = Color3.fromRGB(255, 255, 255)
submit.Text = "Prüfen"
submit.Parent = frame

local corner2 = Instance.new("UICorner")
corner2.CornerRadius = UDim.new(0, 10)
corner2.Parent = submit

local points = Instance.new("TextLabel")
points.Size = UDim2.new(1, -32, 0, 24)
points.Position = UDim2.fromOffset(16, 186)
points.BackgroundTransparency = 1
points.Font = Enum.Font.Gotham
points.TextSize = 15
points.TextColor3 = Color3.fromRGB(140, 255, 200)
points.TextXAlignment = Enum.TextXAlignment.Left
points.Text = "Gelöst: 0"
points.Parent = frame

local close = Instance.new("TextButton")
close.Size = UDim2.fromOffset(80, 26)
close.Position = UDim2.new(1, -96, 0, 14)
close.BackgroundColor3 = Color3.fromRGB(60, 52, 96)
close.BorderSizePixel = 0
close.Font = Enum.Font.Gotham
close.TextSize = 14
close.TextColor3 = Color3.fromRGB(230, 230, 255)
close.Text = "Schließen"
close.Parent = frame

local function sendGuess()
	local text = string.upper(string.gsub(box.Text or "", "%s", ""))
	if #text == 0 then return end
	local event = Remotes:FindFirstChild("WordSubmit")
	if event then event:FireServer(text) end
	box.Text = ""
end

submit.MouseButton1Click:Connect(sendGuess)
box.FocusLost:Connect(function(enterPressed)
	if enterPressed then sendGuess() end
end)
close.MouseButton1Click:Connect(function() frame.Visible = false end)

local roundEvent = Remotes:FindFirstChild("WordRound")
if roundEvent then
	roundEvent.OnClientEvent:Connect(function(data)
		frame.Visible = true
		scrambled.Text = data.scrambled
		hint.Text = "Hinweis: " .. tostring(data.hint)
	end)
end

local solvedEvent = Remotes:FindFirstChild("WordSolved")
if solvedEvent then
	solvedEvent.OnClientEvent:Connect(function(data)
		points.Text = string.format("Gelöst: %d · +%d Punkte", data.solved, data.points)
	end)
end
`;
}

/** Tag-/Nachtzyklus über Lighting, passend zur Palette des Projekts. */
export function dayCycleModule(spec) {
  return `${header(spec, 'DayNightCycle')}local Lighting = game:GetService("Lighting")

local cycle = ${toLua(
    {
      dayLength: spec.genre === 'horror' ? 240 : 420,
      brightnessDay: Number(spec.palette?.brightness ?? 2),
      brightnessNight: 0.4,
      ambientDay: spec.palette?.lightAmbient || [70, 70, 100],
      ambientNight: [18, 18, 30],
    },
    0,
  )}

local clock = 0
local function lerp(a, b, t)
	return a + (b - a) * t
end

while true do
	clock = (clock + 1) % cycle.dayLength
	local phase = clock / cycle.dayLength
	local daylight = math.max(0, math.sin(phase * math.pi * 2))
	Lighting.Brightness = lerp(cycle.brightnessNight, cycle.brightnessDay, daylight)
	local ambient = Color3.fromRGB(
		math.floor(lerp(cycle.ambientNight[1], cycle.ambientDay[1], daylight)),
		math.floor(lerp(cycle.ambientNight[2], cycle.ambientDay[2], daylight)),
		math.floor(lerp(cycle.ambientNight[3], cycle.ambientDay[3], daylight))
	)
	Lighting.Ambient = ambient
	task.wait(1)
end
`;
}

/** Serverseitige Prüfung von Coin- und Kaufanfragen. */
export function antiCheatModule(spec) {
  return `${header(spec, 'AntiCheat')}local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Remotes = ReplicatedStorage:FindFirstChild("Remotes")
local limits = ${toLua({ coinsPerMinute: 900, purchasesPerMinute: 20, maxDistance: 600 }, 0)}

local window = {}

local function bucket(player)
	if not window[player.UserId] then
		window[player.UserId] = { coins = 0, purchases = 0, started = os.time() }
	end
	local entry = window[player.UserId]
	if os.time() - entry.started >= 60 then
		entry.coins = 0
		entry.purchases = 0
		entry.started = os.time()
	end
	return entry
end

local function reject(player, reason)
	local event = Remotes and Remotes:FindFirstChild("Notify")
	if event then
		event:FireClient(player, "Aktion blockiert: " .. reason, Color3.fromRGB(255, 140, 120))
	end
end

if Remotes then
	local buy = Remotes:FindFirstChild("BuyItem")
	if buy then
		buy.OnServerEvent:Connect(function(player)
			local entry = bucket(player)
			entry.purchases = entry.purchases + 1
			if entry.purchases > limits.purchasesPerMinute then
				reject(player, "zu viele Käufe in kurzer Zeit")
			end
		end)
	end
end

Players.PlayerRemoving:Connect(function(player)
	window[player.UserId] = nil
end)
`;
}
