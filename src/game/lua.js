/**
 * Erzeugt die Luau-Quellen, die in jedes generierte Roblox-Projekt eingebaut werden.
 * Der Code ist absichtlich defensiv (pcall um optionale Services), damit ein Projekt
 * auch dann läuft, wenn einzelne Properties beim Serialisieren nicht übernommen wurden.
 */

/** JS-Wert -> Lua-Tabelle. */
export function toLua(value, indent = 0) {
  const pad = '\t'.repeat(indent + 1);
  const closePad = '\t'.repeat(indent);
  if (value === null || value === undefined) return 'nil';
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : '0';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'string') return JSON.stringify(value);
  if (Array.isArray(value)) {
    if (value.length === 0) return '{}';
    const items = value.map((v) => `${pad}${toLua(v, indent + 1)},`);
    return `{\n${items.join('\n')}\n${closePad}}`;
  }
  const keys = Object.keys(value);
  if (keys.length === 0) return '{}';
  const items = keys.map((k) => {
    const key = /^[A-Za-z_][A-Za-z0-9_]*$/.test(k) ? k : `[${JSON.stringify(k)}]`;
    return `${pad}${key} = ${toLua(value[k], indent + 1)},`;
  });
  return `{\n${items.join('\n')}\n${closePad}}`;
}

/** Konfigurationsmodul (Shop, Pets, Quests, Preise, Speicherung). */
export function gameConfigModule(spec, config) {
  return `--!nocheck
-- GameConfig: automatisch erzeugt von Roblox AI Studio für "${spec.title}"
-- Alle Balancing-Werte liegen hier zentral und können frei geändert werden.

local Config = {
\tgameName = ${JSON.stringify(spec.title)},
\tgenre = ${JSON.stringify(spec.genre)},
\tversion = ${JSON.stringify(spec.version || '1.0.0')},
\tsaveKey = ${JSON.stringify('PlayerData_' + (spec.saveSuffix || 'v1'))},
\tstartCoins = ${config.startCoins},
\tcoinValue = ${config.coinValue},
\tcoinRespawn = ${config.coinRespawn},
\txpPerCoin = ${config.xpPerCoin},
\txpPerLevel = ${config.xpPerLevel},
\tmaxLevel = ${config.maxLevel},
\trebirthMultiplier = ${config.rebirthMultiplier},
\tautosaveSeconds = ${config.autosaveSeconds},
\tpets = ${toLua(config.pets, 1)},
\tshops = ${toLua(config.shops, 1)},
\tquests = ${toLua(config.quests, 1)},
\tnpcs = ${toLua(config.npcs, 1)},
\tupgrades = ${toLua(config.upgrades, 1)},
}

function Config.findPet(id)
\tfor _, pet in ipairs(Config.pets) do
\t\tif pet.id == id then return pet end
\tend
\treturn nil
end

function Config.findShop(id)
\tfor _, shop in ipairs(Config.shops) do
\t\tif shop.id == id then return shop end
\tend
\treturn nil
end

function Config.findItem(shopId, itemId)
\tlocal shop = Config.findShop(shopId)
\tif not shop then return nil end
\tfor _, item in ipairs(shop.items) do
\t\tif item.id == itemId then return item end
\tend
\treturn nil
end

function Config.findQuest(id)
\tfor _, quest in ipairs(Config.quests) do
\t\tif quest.id == id then return quest end
\tend
\treturn nil
end

return Config
`;
}

/** UI-Bibliothek: HUD, Fenster, Buttons, Benachrichtigungen, Animationen. */
export function uiLibraryModule(spec) {
  const accent = spec.palette.accent;
  const accent2 = spec.palette.accent2;
  return `--!nocheck
-- UILibrary: baut die komplette Oberfläche zur Laufzeit.
-- Dadurch bleibt das UI unabhängig von der Serialisierung und ist sofort anpassbar.

local TweenService = game:GetService("TweenService")
local Players = game:GetService("Players")

local UI = {}

local ACCENT = Color3.fromRGB(${accent.join(', ')})
local ACCENT2 = Color3.fromRGB(${accent2.join(', ')})
local PANEL = Color3.fromRGB(18, 18, 28)
local PANEL_LIGHT = Color3.fromRGB(28, 28, 42)
local TEXT = Color3.fromRGB(235, 235, 245)
local MUTED = Color3.fromRGB(160, 160, 180)

UI.Accent = ACCENT
UI.Accent2 = ACCENT2

local function corner(parent, radius)
\tlocal c = Instance.new("UICorner")
\tc.CornerRadius = UDim.new(0, radius or 10)
\tc.Parent = parent
\treturn c
end

local function stroke(parent, color, thickness, transparency)
\tlocal s = Instance.new("UIStroke")
\ts.Color = color or ACCENT
\ts.Thickness = thickness or 1
\ts.Transparency = transparency or 0.4
\ts.Parent = parent
\treturn s
end

local function gradient(parent, from, to, rotation)
\tlocal g = Instance.new("UIGradient")
\tg.Color = ColorSequence.new(from or ACCENT, to or ACCENT2)
\tg.Rotation = rotation or 90
\tg.Parent = parent
\treturn g
end

function UI.createScreenGui(name)
\tlocal gui = Instance.new("ScreenGui")
\tgui.Name = name or "GameUI"
\tgui.ResetOnSpawn = false
\tgui.IgnoreGuiInset = true
\tgui.ZIndexBehavior = Enum.ZIndexBehavior.Sibling
\tgui.Parent = Players.LocalPlayer:WaitForChild("PlayerGui")
\treturn gui
end

function UI.panel(parent, config)
\tlocal frame = Instance.new("Frame")
\tframe.Name = config.name or "Panel"
\tframe.Size = config.size or UDim2.fromOffset(300, 400)
\tframe.Position = config.position or UDim2.fromOffset(20, 20)
\tframe.AnchorPoint = config.anchor or Vector2.new(0, 0)
\tframe.BackgroundColor3 = config.color or PANEL
\tframe.BackgroundTransparency = config.transparency or 0.05
\tframe.BorderSizePixel = 0
\tframe.Visible = config.visible ~= false
\tframe.Parent = parent
\tcorner(frame, config.radius or 14)
\tstroke(frame, config.strokeColor, 1, 0.35)
\treturn frame
end

function UI.label(parent, config)
\tlocal label = Instance.new("TextLabel")
\tlabel.Name = config.name or "Label"
\tlabel.Size = config.size or UDim2.new(1, -20, 0, 24)
\tlabel.Position = config.position or UDim2.fromOffset(10, 8)
\tlabel.BackgroundTransparency = 1
\tlabel.Font = config.font or Enum.Font.GothamMedium
\tlabel.Text = config.text or ""
\tlabel.TextColor3 = config.color or TEXT
\tlabel.TextSize = config.textSize or 16
\tlabel.TextXAlignment = config.align or Enum.TextXAlignment.Left
\tlabel.TextYAlignment = Enum.TextYAlignment.Center
\tlabel.TextScaled = config.scaled or false
\tlabel.RichText = true
\tlabel.Parent = parent
\treturn label
end

function UI.button(parent, config)
\tlocal button = Instance.new("TextButton")
\tbutton.Name = config.name or "Button"
\tbutton.Size = config.size or UDim2.new(1, -20, 0, 38)
\tbutton.Position = config.position or UDim2.fromOffset(10, 10)
\tbutton.BackgroundColor3 = config.color or PANEL_LIGHT
\tbutton.BorderSizePixel = 0
\tbutton.Font = Enum.Font.GothamBold
\tbutton.Text = config.text or "Button"
\tbutton.TextColor3 = config.color and Color3.new(1, 1, 1) or TEXT
\tbutton.TextSize = config.textSize or 15
\tbutton.AutoButtonColor = true
\tbutton.Parent = parent
\tcorner(button, 8)
\tstroke(button, config.strokeColor or ACCENT, 1, 0.5)

\tbutton.MouseEnter:Connect(function()
\t\tTweenService:Create(button, TweenInfo.new(0.15), { BackgroundColor3 = ACCENT }):Play()
\tend)
\tbutton.MouseLeave:Connect(function()
\t\tTweenService:Create(button, TweenInfo.new(0.15), { BackgroundColor3 = config.color or PANEL_LIGHT }):Play()
\tend)
\treturn button
end

function UI.bar(parent, config)
\tlocal holder = Instance.new("Frame")
\tholder.Name = config.name or "Bar"
\tholder.Size = config.size or UDim2.new(1, -20, 0, 10)
\tholder.Position = config.position or UDim2.fromOffset(10, 10)
\tholder.BackgroundColor3 = Color3.fromRGB(40, 40, 58)
\tholder.BorderSizePixel = 0
\tholder.Parent = parent
\tcorner(holder, 6)

\tlocal fill = Instance.new("Frame")
\tfill.Name = "Fill"
\tfill.Size = UDim2.fromScale(0, 1)
\tfill.BackgroundColor3 = ACCENT
\tfill.BorderSizePixel = 0
\tfill.Parent = holder
\tcorner(fill, 6)
\tgradient(fill, ACCENT, ACCENT2, 0)

\tfunction holder.set(percent)
\t\tlocal clamped = math.clamp(percent or 0, 0, 1)
\t\tTweenService:Create(fill, TweenInfo.new(0.3, Enum.EasingStyle.Quad), { Size = UDim2.fromScale(clamped, 1) }):Play()
\tend

\treturn holder
end

function UI.toggle(frame, open)
\tlocal goal = open and UDim2.fromScale(1, 1) or UDim2.fromScale(0.8, 0.8)
\tframe.Visible = true
\tframe.Size = goal
\tframe.BackgroundTransparency = 1
\tTweenService:Create(frame, TweenInfo.new(0.2, Enum.EasingStyle.Back), {
\t\tSize = open and frame:GetAttribute("OpenSize") or goal,
\t\tBackgroundTransparency = 0.05,
\t}):Play()
end

function UI.scrollingList(parent, position, size)
\tlocal scroll = Instance.new("ScrollingFrame")
\tscroll.Name = "List"
\tscroll.Position = position or UDim2.fromOffset(10, 50)
\tscroll.Size = size or UDim2.new(1, -20, 1, -60)
\tscroll.BackgroundTransparency = 1
\tscroll.BorderSizePixel = 0
\tscroll.ScrollBarThickness = 4
\tscroll.ScrollBarImageColor3 = ACCENT
\tscroll.CanvasSize = UDim2.new(0, 0, 0, 0)
\tscroll.AutomaticCanvasSize = Enum.AutomaticSize.Y
\tscroll.Parent = parent
\tlocal layout = Instance.new("UIListLayout")
\tlayout.Padding = UDim.new(0, 8)
\tlayout.SortOrder = Enum.SortOrder.LayoutOrder
\tlayout.Parent = scroll
\treturn scroll
end

function UI.notify(gui, text, color)
\tlocal holder = gui:FindFirstChild("Notifications")
\tif not holder then
\t\tholder = Instance.new("Frame")
\t\tholder.Name = "Notifications"
\t\tholder.Size = UDim2.new(0, 320, 1, -40)
\t\tholder.Position = UDim2.new(0.5, -160, 0, 90)
\t\tholder.BackgroundTransparency = 1
\t\tholder.Parent = gui
\t\tlocal layout = Instance.new("UIListLayout")
\t\tlayout.Padding = UDim.new(0, 6)
\t\tlayout.HorizontalAlignment = Enum.HorizontalAlignment.Center
\t\tlayout.Parent = holder
\tend

\tlocal toast = Instance.new("TextLabel")
\ttoast.Size = UDim2.new(1, 0, 0, 34)
\ttoast.BackgroundColor3 = PANEL_LIGHT
\ttoast.BackgroundTransparency = 0.1
\ttoast.BorderSizePixel = 0
\ttoast.Font = Enum.Font.GothamBold
\ttoast.Text = text
\ttoast.TextColor3 = color or TEXT
\ttoast.TextSize = 14
\ttoast.TextTransparency = 1
\ttoast.Parent = holder
\tcorner(toast, 8)
\tstroke(toast, color or ACCENT, 1, 0.3)

\tTweenService:Create(toast, TweenInfo.new(0.25), { TextTransparency = 0, BackgroundTransparency = 0.1 }):Play()
\ttask.delay(2.4, function()
\t\tlocal fade = TweenService:Create(toast, TweenInfo.new(0.4), { TextTransparency = 1, BackgroundTransparency = 1 })
\t\tfade:Play()
\t\tfade.Completed:Connect(function()
\t\t\ttoast:Destroy()
\t\tend)
\tend)
end

function UI.card(parent, order)
\tlocal card = Instance.new("Frame")
\tcard.Name = "Card"
\tcard.Size = UDim2.new(1, -8, 0, 64)
\tcard.BackgroundColor3 = PANEL_LIGHT
\tcard.BackgroundTransparency = 0.15
\tcard.BorderSizePixel = 0
\tcard.LayoutOrder = order or 0
\tcard.Parent = parent
\tcorner(card, 10)
\tstroke(card, ACCENT, 1, 0.6)
\treturn card
end

return UI
`;
}

/** Serverseitige Spiellogik: Daten, Wirtschaft, Shops, Pets, Quests, Zonen, NPCs. */
export function serverMainModule(spec, config) {
  return `--!nocheck
-- GameServer: Datenverwaltung, Wirtschaft, Shops, Pets, Quests und Zonen.
-- Erzeugt von Roblox AI Studio.

local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local DataStoreService = game:GetService("DataStoreService")
local RunService = game:GetService("RunService")
local Workspace = game:GetService("Workspace")

local Config = require(ReplicatedStorage:WaitForChild("Shared"):WaitForChild("GameConfig"))
local Remotes = ReplicatedStorage:WaitForChild("Remotes")

local dataStore
local ok = pcall(function()
\tdataStore = DataStoreService:GetDataStore(Config.saveKey)
end)
if not ok then
\twarn("[GameServer] DataStore nicht verfügbar - Fortschritt wird nur in der Session gehalten.")
end

local sessions = {}

local function defaultData()
\tlocal quests = {}
\tfor _, quest in ipairs(Config.quests) do
\t\tquests[quest.id] = 0
\tend
\treturn {
\t\tcoins = Config.startCoins,
\t\tlevel = 1,
\t\txp = 0,
\t\trebirths = 0,
\t\tpets = {},
\t\tequipped = "",
\t\tquests = quests,
\t\tclaimed = {},
\t\tunlocked = {},
\t\tupgrades = 0,
\t\tplaytime = 0,
\t}
end

local function keyFor(player)
\treturn "player_" .. tostring(player.UserId)
end

local function loadData(player)
\tlocal data = defaultData()
\tif dataStore then
\t\tlocal success, stored = pcall(function()
\t\t\treturn dataStore:GetAsync(keyFor(player))
\t\tend)
\t\tif success and type(stored) == "table" then
\t\t\tfor key, value in pairs(stored) do
\t\t\t\tdata[key] = value
\t\t\tend
\t\t\tfor _, quest in ipairs(Config.quests) do
\t\t\t\tif data.quests[quest.id] == nil then data.quests[quest.id] = 0 end
\t\t\tend
\t\telseif not success then
\t\t\twarn("[GameServer] Laden fehlgeschlagen für " .. player.Name)
\t\tend
\tend
\tsessions[player.UserId] = data
\treturn data
end

local function saveData(player)
\tlocal data = sessions[player.UserId]
\tif not data or not dataStore then return end
\tpcall(function()
\t\tdataStore:SetAsync(keyFor(player), data)
\tend)
end

local function multiplierFor(data)
\tlocal mult = 1 + data.upgrades * 0.25 + data.rebirths * Config.rebirthMultiplier
\tlocal pet = Config.findPet(data.equipped)
\tif pet then mult = mult * pet.multiplier end
\treturn mult
end

local function syncPlayer(player)
\tlocal data = sessions[player.UserId]
\tif not data then return end
\tlocal stats = player:FindFirstChild("leaderstats")
\tif stats then
\t\tlocal coins = stats:FindFirstChild("Coins")
\t\tlocal level = stats:FindFirstChild("Level")
\t\tlocal rebirths = stats:FindFirstChild("Rebirths")
\t\tif coins then coins.Value = data.coins end
\t\tif level then level.Value = data.level end
\t\tif rebirths then rebirths.Value = data.rebirths end
\tend
\tRemotes.DataSync:FireClient(player, {
\t\tcoins = data.coins,
\t\tlevel = data.level,
\t\txp = data.xp,
\t\txpNeeded = Config.xpPerLevel,
\t\trebirths = data.rebirths,
\t\tpets = data.pets,
\t\tequipped = data.equipped,
\t\tquests = data.quests,
\t\tclaimed = data.claimed,
\t\tunlocked = data.unlocked,
\t\tupgrades = data.upgrades,
\t\tmultiplier = multiplierFor(data),
\t})
end

local function addCoins(player, amount)
\tlocal data = sessions[player.UserId]
\tif not data then return end
\tlocal gained = math.floor(amount * multiplierFor(data))
\tdata.coins += gained
\tdata.xp += Config.xpPerCoin * math.max(1, gained)
\twhile data.xp >= Config.xpPerLevel and data.level < Config.maxLevel do
\t\tdata.xp -= Config.xpPerLevel
\t\tdata.level += 1
\t\tRemotes.Notify:FireClient(player, "Level " .. data.level .. " erreicht!", "level")
\tend
\tif data.level >= Config.maxLevel then data.xp = math.min(data.xp, Config.xpPerLevel) end
\tlocal quests = data.quests
\tif quests["collect_coins"] then quests["collect_coins"] += 1 end
\tsyncPlayer(player)
\treturn gained
end

local function setupPlayer(player)
\tlocal data = loadData(player)
\tlocal leaderstats = Instance.new("Folder")
\tleaderstats.Name = "leaderstats"
\tleaderstats.Parent = player

\tlocal coins = Instance.new("IntValue")
\tcoins.Name = "Coins"
\tcoins.Value = data.coins
\tcoins.Parent = leaderstats

\tlocal level = Instance.new("IntValue")
\tlevel.Name = "Level"
\tlevel.Value = data.level
\tlevel.Parent = leaderstats

\tlocal rebirths = Instance.new("IntValue")
\trebirths.Name = "Rebirths"
\trebirths.Value = data.rebirths
\trebirths.Parent = leaderstats

\tplayer.CharacterAdded:Connect(function(character)
\t\ttask.wait(1)
\t\tsyncPlayer(player)
\t\tif data.equipped ~= "" then
\t\t\tRemotes.PetEquipped:FireClient(player, data.equipped)
\t\tend
\tend)

\ttask.wait(0.5)
\tsyncPlayer(player)
end

-- Coins in der Welt -----------------------------------------------------------------
local function spawnCoin(spot)
\tlocal coin = Instance.new("Part")
\tcoin.Name = "Coin"
\tcoin.Shape = Enum.PartType.Cylinder
\tcoin.Size = Vector3.new(0.3, 2, 2)
\tcoin.Color = Color3.fromRGB(255, 205, 60)
\tcoin.Material = Enum.Material.Neon
\tcoin.Anchored = true
\tcoin.CanCollide = false
\tcoin.CFrame = spot.CFrame * CFrame.Angles(0, 0, math.rad(90))
\tcoin.Parent = Workspace:FindFirstChild("RuntimeCoins") or (function()
\t\tlocal folder = Instance.new("Folder")
\t\tfolder.Name = "RuntimeCoins"
\t\tfolder.Parent = Workspace
\t\treturn folder
\tend)()

\tlocal light = Instance.new("PointLight")
\tlight.Color = Color3.fromRGB(255, 220, 120)
\tlight.Brightness = 1.2
\tlight.Range = 10
\tlight.Parent = coin

\tlocal spin = RunService.Heartbeat:Connect(function()
\t\tif coin.Parent then
\t\t\tcoin.CFrame = coin.CFrame * CFrame.Angles(0, math.rad(2), 0)
\t\tend
\tend)

\tlocal taken = false
\tcoin.Touched:Connect(function(hit)
\t\tif taken then return end
\t\tlocal character = hit.Parent
\t\tlocal player = character and Players:GetPlayerFromCharacter(character)
\t\tif not player then return end
\t\ttaken = true
\t\tlocal gained = addCoins(player, Config.coinValue)
\t\tif gained then
\t\t\tRemotes.Notify:FireClient(player, "+" .. tostring(gained) .. " Coins", "coin")
\t\tend
\t\tspin:Disconnect()
\t\tcoin:Destroy()
\t\ttask.delay(Config.coinRespawn, function()
\t\t\tif spot.Parent then spawnCoin(spot) end
\t\tend)
\tend)
end

local coinFolder = Workspace:WaitForChild("CoinSpots", 10)
if coinFolder then
\tfor _, spot in ipairs(coinFolder:GetChildren()) do
\t\tif spot:IsA("BasePart") then
\t\t\tspawnCoin(spot)
\t\tend
\tend
end

-- Shops -----------------------------------------------------------------------------
local function applyPurchase(player, item, shopId)
\tlocal data = sessions[player.UserId]
\tif not data then return false, "Kein Spielstand" end
\tif data.coins < item.price then return false, "Zu wenig Coins" end

\tif item.kind == "pet" then
\t\tif table.find(data.pets, item.value) then return false, "Pet bereits vorhanden" end
\t\tdata.coins -= item.price
\t\ttable.insert(data.pets, item.value)
\t\tdata.equipped = item.value
\t\tRemotes.PetEquipped:FireClient(player, item.value)
\telseif item.kind == "upgrade" then
\t\tdata.coins -= item.price
\t\tdata.upgrades += (item.amount or 1)
\telseif item.kind == "unlock" then
\t\tdata.coins -= item.price
\t\tdata.unlocked[item.value] = true
\t\tlocal gate = Workspace:FindFirstChild(item.value, true)
\t\tif gate then gate:Destroy() end
\t\tRemotes.Notify:FireClient(player, "Bereich freigeschaltet!", "unlock")
\telse
\t\tdata.coins -= item.price
\tend

\tlocal quests = data.quests
\tif quests["buy_items"] then quests["buy_items"] += 1 end
\tsyncPlayer(player)
\treturn true, "Gekauft: " .. item.name
end

Remotes.BuyItem.OnServerEvent:Connect(function(player, shopId, itemId)
\tlocal item = Config.findItem(shopId, itemId)
\tif not item then
\t\tRemotes.Notify:FireClient(player, "Artikel nicht gefunden", "error")
\t\treturn
\tend
\tlocal success, message = applyPurchase(player, item, shopId)
\tRemotes.Notify:FireClient(player, message, success and "buy" or "error")
end)

Remotes.EquipPet.OnServerEvent:Connect(function(player, petId)
\tlocal data = sessions[player.UserId]
\tif not data then return end
\tif petId ~= "" and not table.find(data.pets, petId) then return end
\tdata.equipped = petId
\tRemotes.PetEquipped:FireClient(player, petId)
\tsyncPlayer(player)
end)

Remotes.ClaimQuest.OnServerEvent:Connect(function(player, questId)
\tlocal data = sessions[player.UserId]
\tlocal quest = Config.findQuest(questId)
\tif not data or not quest then return end
\tif data.claimed[questId] then return end
\tif (data.quests[questId] or 0) < quest.goal then
\t\tRemotes.Notify:FireClient(player, "Quest noch nicht abgeschlossen", "error")
\t\treturn
\tend
\tdata.claimed[questId] = true
\tdata.coins += quest.reward
\tRemotes.Notify:FireClient(player, "Quest belohnt: +" .. quest.reward .. " Coins", "quest")
\tsyncPlayer(player)
end)

Remotes.Rebirth.OnServerEvent:Connect(function(player)
\tlocal data = sessions[player.UserId]
\tif not data then return end
\tlocal needed = Config.maxLevel * Config.xpPerLevel
\tif data.level < Config.maxLevel then
\t\tRemotes.Notify:FireClient(player, "Erst Level " .. Config.maxLevel .. " erreichen", "error")
\t\treturn
\tend
\tdata.rebirths += 1
\tdata.level = 1
\tdata.xp = 0
\tdata.coins = Config.startCoins
\tRemotes.Notify:FireClient(player, "Rebirth " .. data.rebirths .. "! Multiplikator erhöht.", "rebirth")
\tsyncPlayer(player)
end)

-- Pet-Begleiter ---------------------------------------------------------------------
local petModels = {}

local function buildPetModel(pet, character)
\tlocal model = Instance.new("Model")
\tmodel.Name = "Pet_" .. pet.id

\tlocal body = Instance.new("Part")
\tbody.Name = "Body"
\tbody.Shape = Enum.PartType.Ball
\tbody.Size = Vector3.new(2, 2, 2)
\tbody.Color = Color3.fromRGB(pet.color[1], pet.color[2], pet.color[3])
\tbody.Material = Enum.Material.Neon
\tbody.Anchored = true
\tbody.CanCollide = false
\tbody.Parent = model

\tlocal eye = Instance.new("Part")
\teye.Name = "Glow"
\teye.Shape = Enum.PartType.Ball
\teye.Size = Vector3.new(0.6, 0.6, 0.6)
\teye.Color = Color3.fromRGB(255, 255, 255)
\teye.Material = Enum.Material.Neon
\teye.Anchored = true
\teye.CanCollide = false
\teye.Parent = model

\tmodel.Parent = Workspace
\treturn model
end

local function followLoop(player, petId)
\tlocal data = sessions[player.UserId]
\tif not data then return end
\tlocal pet = Config.findPet(petId)
\tif not pet then return end
\tlocal character = player.Character or player.CharacterAdded:Wait()
\tlocal root = character:WaitForChild("HumanoidRootPart", 5)
\tif not root then return end

\tif petModels[player.UserId] then
\t\tpetModels[player.UserId]:Destroy()
\tend
\tlocal model = buildPetModel(pet, character)
\tpetModels[player.UserId] = model

\tlocal angle = 0
\tlocal connection
\tconnection = RunService.Heartbeat:Connect(function(dt)
\t\tif not model.Parent or not root.Parent then
\t\t\tconnection:Disconnect()
\t\t\tmodel:Destroy()
\t\t\treturn
\t\tend
\t\tangle += dt * 1.6
\t\tlocal offset = Vector3.new(math.cos(angle) * 4, 2.5 + math.sin(angle * 2) * 0.4, math.sin(angle) * 4)
\t\tlocal target = root.Position + offset
\t\tlocal body = model:FindFirstChild("Body")
\t\tlocal glow = model:FindFirstChild("Glow")
\t\tif body then
\t\t\tbody.CFrame = body.CFrame:Lerp(CFrame.new(target), 0.2)
\t\t\tif glow then glow.CFrame = body.CFrame * CFrame.new(0, 0, 0.9) end
\t\tend
\tend)
end

Remotes.PetEquipped.OnServerEvent:Connect(function(player, petId)
\tlocal data = sessions[player.UserId]
\tif not data then return end
\tdata.equipped = petId
\tif petModels[player.UserId] then
\t\tpetModels[player.UserId]:Destroy()
\t\tpetModels[player.UserId] = nil
\tend
\tif petId ~= "" then followLoop(player, petId) end
\tsyncPlayer(player)
end)

-- NPC-Dialoge -----------------------------------------------------------------------
for _, npc in ipairs(Config.npcs) do
\tlocal model = Workspace:FindFirstChild("NPCs") and Workspace.NPCs:FindFirstChild(npc.id)
\tif model then
\t\tlocal prompt = model:FindFirstChildWhichIsA("ProximityPrompt", true)
\t\tif prompt then
\t\t\tprompt.Triggered:Connect(function(player)
\t\t\t\tRemotes.Dialog:FireClient(player, npc)
\t\t\tend)
\t\tend
\tend
end

-- Spieler-Lifecycle -----------------------------------------------------------------
Players.PlayerAdded:Connect(setupPlayer)
for _, player in ipairs(Players:GetPlayers()) do
\ttask.spawn(setupPlayer, player)
end

Players.PlayerRemoving:Connect(function(player)
\tsaveData(player)
\tsessions[player.UserId] = nil
\tif petModels[player.UserId] then
\t\tpetModels[player.UserId]:Destroy()
\t\tpetModels[player.UserId] = nil
\tend
end)

task.spawn(function()
\twhile true do
\t\ttask.wait(Config.autosaveSeconds)
\t\tfor _, player in ipairs(Players:GetPlayers()) do
\t\t\tsaveData(player)
\t\tend
\tend
end)

game:BindToClose(function()
\tfor _, player in ipairs(Players:GetPlayers()) do
\t\tsaveData(player)
\tend
\ttask.wait(1)
end)

print("[GameServer] " .. Config.gameName .. " gestartet.")
`;
}

/** Client: HUD, Shop, Inventar, Quests, Dialoge, Animationen. */
export function clientMainModule(spec) {
  return `--!nocheck
-- ClientMain: baut HUD, Shop, Inventar, Quests und Dialoge auf.

local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local TweenService = game:GetService("TweenService")
local UserInputService = game:GetService("UserInputService")

local Config = require(ReplicatedStorage:WaitForChild("Shared"):WaitForChild("GameConfig"))
local UI = require(ReplicatedStorage:WaitForChild("Shared"):WaitForChild("UILibrary"))
local Remotes = ReplicatedStorage:WaitForChild("Remotes")

local player = Players.LocalPlayer
local gui = UI.createScreenGui("GameUI")
local state = { coins = 0, level = 1, xp = 0, xpNeeded = 100, rebirths = 0, pets = {}, equipped = "", quests = {}, claimed = {}, multiplier = 1 }

-- HUD -------------------------------------------------------------------------------
local hud = UI.panel(gui, { name = "HUD", size = UDim2.fromOffset(320, 116), position = UDim2.fromOffset(16, 16) })
UI.label(hud, { name = "Title", text = Config.gameName, size = UDim2.new(1, -20, 0, 22), position = UDim2.fromOffset(12, 8), textSize = 16, color = UI.Accent })
local coinLabel = UI.label(hud, { name = "Coins", text = "0 Coins", size = UDim2.new(0.5, -12, 0, 24), position = UDim2.fromOffset(12, 34), textSize = 20 })
local multiLabel = UI.label(hud, { name = "Multi", text = "x1", size = UDim2.new(0.5, -12, 0, 24), position = UDim2.new(0.5, 0, 0, 34), textSize = 18, align = Enum.TextXAlignment.Right, color = UI.Accent2 })
local levelLabel = UI.label(hud, { name = "Level", text = "Level 1", size = UDim2.new(1, -20, 0, 18), position = UDim2.fromOffset(12, 60), textSize = 13, color = Color3.fromRGB(170, 170, 190) })
local xpBar = UI.bar(hud, { name = "XP", size = UDim2.new(1, -24, 0, 8), position = UDim2.fromOffset(12, 82) })
local rebirthLabel = UI.label(hud, { name = "Rebirth", text = "Rebirths: 0", size = UDim2.new(1, -20, 0, 16), position = UDim2.fromOffset(12, 94), textSize = 12, color = Color3.fromRGB(150, 150, 170) })

-- Schnellzugriff ---------------------------------------------------------------------
local dock = UI.panel(gui, { name = "Dock", size = UDim2.fromOffset(430, 52), position = UDim2.new(0.5, -215, 1, -68) })
local dockLayout = Instance.new("UIListLayout")
dockLayout.FillDirection = Enum.FillDirection.Horizontal
dockLayout.Padding = UDim.new(0, 8)
dockLayout.HorizontalAlignment = Enum.HorizontalAlignment.Center
dockLayout.VerticalAlignment = Enum.VerticalAlignment.Center
dockLayout.Parent = dock

local shopButton = UI.button(dock, { name = "ShopButton", text = "Shop", size = UDim2.fromOffset(96, 34) })
local petButton = UI.button(dock, { name = "PetButton", text = "Pets", size = UDim2.fromOffset(96, 34) })
local questButton = UI.button(dock, { name = "QuestButton", text = "Quests", size = UDim2.fromOffset(96, 34) })
local rebirthButton = UI.button(dock, { name = "RebirthButton", text = "Rebirth", size = UDim2.fromOffset(110, 34) })

-- Fenster ----------------------------------------------------------------------------
local function buildWindow(title, size, position)
\tlocal window = UI.panel(gui, { name = title .. "Window", size = size, position = position, anchor = Vector2.new(0.5, 0.5), visible = false })
\tUI.label(window, { name = "Header", text = title, size = UDim2.new(1, -60, 0, 34), position = UDim2.fromOffset(14, 8), textSize = 20, color = UI.Accent })
\tlocal close = UI.button(window, { name = "Close", text = "X", size = UDim2.fromOffset(30, 30), position = UDim2.new(1, -40, 0, 8), color = Color3.fromRGB(60, 40, 70) })
\tlocal list = UI.scrollingList(window, UDim2.fromOffset(12, 48), UDim2.new(1, -24, 1, -60))
\tclose.MouseButton1Click:Connect(function()
\t\twindow.Visible = false
\tend)
\twindow:SetAttribute("OpenSize", UDim2.fromScale(1, 1))
\twindow.Size = size
\treturn window, list
end

local shopWindow, shopList = buildWindow("Shop", UDim2.fromOffset(440, 420), UDim2.fromScale(0.5, 0.5))
local petWindow, petList = buildWindow("Pets", UDim2.fromOffset(440, 420), UDim2.fromScale(0.5, 0.5))
local questWindow, questList = buildWindow("Quests", UDim2.fromOffset(440, 420), UDim2.fromScale(0.5, 0.5))

local function clearList(list)
\tfor _, child in ipairs(list:GetChildren()) do
\t\tif child:IsA("Frame") then child:Destroy() end
\tend
end

local function renderShops()
\tclearList(shopList)
\tlocal order = 0
\tfor _, shop in ipairs(Config.shops) do
\t\torder += 1
\t\tlocal header = UI.label(shopList, { name = "ShopHeader", text = shop.name .. "  -  " .. (shop.description or ""), size = UDim2.new(1, -8, 0, 22), textSize = 14, color = UI.Accent2 })
\t\theader.LayoutOrder = order
\t\tfor _, item in ipairs(shop.items) do
\t\t\torder += 1
\t\t\tlocal card = UI.card(shopList, order)
\t\t\tUI.label(card, { name = "Name", text = item.name, size = UDim2.new(0.6, -12, 0, 20), position = UDim2.fromOffset(10, 8), textSize = 15 })
\t\t\tUI.label(card, { name = "Desc", text = item.description or "", size = UDim2.new(0.6, -12, 0, 18), position = UDim2.fromOffset(10, 28), textSize = 12, color = Color3.fromRGB(160, 160, 180) })
\t\t\tUI.label(card, { name = "Price", text = item.price .. " Coins", size = UDim2.fromOffset(110, 20), position = UDim2.new(1, -240, 0, 22), textSize = 13, align = Enum.TextXAlignment.Right, color = Color3.fromRGB(255, 205, 60) })
\t\t\tlocal buy = UI.button(card, { name = "Buy", text = "Kaufen", size = UDim2.fromOffset(100, 32), position = UDim2.new(1, -112, 0, 16) })
\t\t\tbuy.MouseButton1Click:Connect(function()
\t\t\t\tRemotes.BuyItem:FireServer(shop.id, item.id)
\t\t\tend)
\t\tend
\tend
end

local function renderPets()
\tclearList(petList)
\tif #state.pets == 0 then
\t\tUI.label(petList, { name = "Empty", text = "Noch keine Pets. Kaufe dein erstes Pet im Shop!", size = UDim2.new(1, -8, 0, 40), textSize = 14, color = Color3.fromRGB(160, 160, 180) })
\t\treturn
\tend
\tlocal order = 0
\tfor _, petId in ipairs(state.pets) do
\t\tlocal pet = Config.findPet(petId)
\t\tif pet then
\t\t\torder += 1
\t\t\tlocal card = UI.card(petList, order)
\t\t\tUI.label(card, { name = "Name", text = pet.name, size = UDim2.new(0.6, -12, 0, 22), position = UDim2.fromOffset(10, 10), textSize = 16 })
\t\t\tUI.label(card, { name = "Multi", text = "x" .. pet.multiplier .. " Coins", size = UDim2.new(0.6, -12, 0, 18), position = UDim2.fromOffset(10, 32), textSize = 12, color = UI.Accent2 })
\t\t\tlocal equip = UI.button(card, { name = "Equip", text = state.equipped == petId and "Aktiv" or "Ausrüsten", size = UDim2.fromOffset(110, 32), position = UDim2.new(1, -122, 0, 16) })
\t\t\tequip.MouseButton1Click:Connect(function()
\t\t\t\tRemotes.PetEquipped:FireServer(state.equipped == petId and "" or petId)
\t\t\tend)
\t\tend
\tend
end

local function renderQuests()
\tclearList(questList)
\tlocal order = 0
\tfor _, quest in ipairs(Config.quests) do
\t\torder += 1
\t\tlocal progress = state.quests[quest.id] or 0
\t\tlocal card = UI.card(questList, order)
\t\tUI.label(card, { name = "Name", text = quest.name, size = UDim2.new(0.6, -12, 0, 20), position = UDim2.fromOffset(10, 8), textSize = 15 })
\t\tUI.label(card, { name = "Desc", text = quest.description, size = UDim2.new(0.6, -12, 0, 18), position = UDim2.fromOffset(10, 28), textSize = 12, color = Color3.fromRGB(160, 160, 180) })
\t\tUI.label(card, { name = "Progress", text = math.min(progress, quest.goal) .. " / " .. quest.goal, size = UDim2.fromOffset(90, 18), position = UDim2.new(1, -230, 0, 24), textSize = 13, align = Enum.TextXAlignment.Right })
\t\tlocal claim = UI.button(card, { name = "Claim", text = state.claimed[quest.id] and "Belohnt" or "+" .. quest.reward, size = UDim2.fromOffset(110, 32), position = UDim2.new(1, -122, 0, 16) })
\t\tif state.claimed[quest.id] then claim.BackgroundTransparency = 0.5 end
\t\tclaim.MouseButton1Click:Connect(function()
\t\t\tRemotes.ClaimQuest:FireServer(quest.id)
\t\tend)
\tend
end

shopButton.MouseButton1Click:Connect(function()
\trenderShops()
\tshopWindow.Visible = not shopWindow.Visible
end)
petButton.MouseButton1Click:Connect(function()
\trenderPets()
\tpetWindow.Visible = not petWindow.Visible
end)
questButton.MouseButton1Click:Connect(function()
\trenderQuests()
\tquestWindow.Visible = not questWindow.Visible
end)
rebirthButton.MouseButton1Click:Connect(function()
\tRemotes.Rebirth:FireServer()
end)

-- Serverseite synchronisieren --------------------------------------------------------
Remotes.DataSync.OnClientEvent:Connect(function(data)
\tstate = data
\tcoinLabel.Text = string.format("%d Coins", data.coins)
\tmultiLabel.Text = "x" .. string.format("%.2f", data.multiplier or 1)
\tlevelLabel.Text = "Level " .. data.level .. "  (" .. data.xp .. " / " .. data.xpNeeded .. " XP)"
\trebirthLabel.Text = "Rebirths: " .. data.rebirths .. "   Upgrades: " .. data.upgrades
\txpBar.set(data.xp / math.max(1, data.xpNeeded))
\tif shopWindow.Visible then renderShops() end
\tif petWindow.Visible then renderPets() end
\tif questWindow.Visible then renderQuests() end
end)

Remotes.Notify.OnClientEvent:Connect(function(text, kind)
\tlocal color = UI.Accent
\tif kind == "error" then color = Color3.fromRGB(255, 110, 110) end
\tif kind == "coin" then color = Color3.fromRGB(255, 205, 60) end
\tif kind == "quest" then color = Color3.fromRGB(120, 255, 180) end
\tUI.notify(gui, text, color)
end)

Remotes.Dialog.OnClientEvent:Connect(function(npc)
\tlocal box = UI.panel(gui, { name = "Dialog", size = UDim2.fromOffset(520, 130), position = UDim2.new(0.5, -260, 1, -210) })
\tUI.label(box, { name = "Name", text = npc.name, size = UDim2.new(1, -24, 0, 26), position = UDim2.fromOffset(14, 10), textSize = 18, color = UI.Accent })
\tUI.label(box, { name = "Text", text = npc.dialog, size = UDim2.new(1, -28, 1, -60), position = UDim2.fromOffset(14, 40), textSize = 14, color = Color3.fromRGB(220, 220, 235), align = Enum.TextXAlignment.Left })
\tlocal close = UI.button(box, { name = "Close", text = "Weiter", size = UDim2.fromOffset(100, 28), position = UDim2.new(1, -112, 1, -38) })
\tclose.MouseButton1Click:Connect(function()
\t\tbox:Destroy()
\tend)
\ttask.delay(10, function()
\t\tif box.Parent then box:Destroy() end
\tend)
end)

Remotes.PetEquipped.OnClientEvent:Connect(function(petId)
\tstate.equipped = petId
\tif petWindow.Visible then renderPets() end
end)

-- Tastaturkürzel ---------------------------------------------------------------------
UserInputService.InputBegan:Connect(function(input, processed)
\tif processed then return end
\tif input.KeyCode == Enum.KeyCode.E then
\t\trenderShops()
\t\tshopWindow.Visible = not shopWindow.Visible
\telseif input.KeyCode == Enum.KeyCode.Q then
\t\trenderQuests()
\t\tquestWindow.Visible = not questWindow.Visible
\telseif input.KeyCode == Enum.KeyCode.P then
\t\trenderPets()
\t\tpetWindow.Visible = not petWindow.Visible
\tend
end)

renderShops()
print("[ClientMain] UI bereit für " .. Config.gameName)
`;
}

/** Stabilisiert die Map (verhindert, dass Teile bei abweichender Serialisierung fallen). */
export function mapStabilizerModule(spec) {
  return `--!nocheck
-- MapStabilizer: sorgt dafür, dass die gesamte Karte fest steht und Beleuchtung stimmt.
local Workspace = game:GetService("Workspace")

for _, item in ipairs(Workspace:GetDescendants()) do
\tif item:IsA("BasePart") then
\t\tif not item:FindFirstAncestorOfClass("Model") or item.Parent:IsA("Folder") or item.Parent == Workspace then
\t\t\titem.Anchored = true
\t\tend
\tend
end

pcall(function()
\tlocal Lighting = game:GetService("Lighting")
\tLighting.Ambient = Color3.fromRGB(${spec.palette.lightAmbient.join(', ')})
\tLighting.OutdoorAmbient = Color3.fromRGB(${spec.palette.lightOutdoor.join(', ')})
\tLighting.Brightness = ${spec.palette.brightness}
\tif ${spec.genre === 'horror' ? 'true' : 'false'} then
\t\tLighting.ClockTime = 0
\t\tLighting.FogEnd = 220
\t\tLighting.FogColor = Color3.fromRGB(30, 26, 44)
\tend
end)

print("[MapStabilizer] Karte gesichert.")
`;
}
