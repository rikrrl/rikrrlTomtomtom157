--!strict
--[[
	Roblox AI Studio – Studio-Plugin
	Verbindet Roblox Studio mit der Web-Plattform: holt den Bauplan eines Projekts
	und legt Map, Gebäude, Shops, NPCs, GUI und Luau-Skripte direkt in Studio an.

	Installation:
	 1. Datei als RobloxAIStudio.plugin.lua in den Plugins-Ordner legen
	    Windows: %LOCALAPPDATA%\Roblox\Plugins
	    macOS:   ~/Documents/Roblox/Plugins
	 2. Studio neu starten, dann im Plugins-Tab "Roblox AI Studio" öffnen.
	 3. Server-URL, Projekt-ID und Token aus der Webseite einfügen.
]]

local HttpService = game:GetService("HttpService")
local ChangeHistoryService = game:GetService("ChangeHistoryService")
local Selection = game:GetService("Selection")

local toolbar = plugin:CreateToolbar("Roblox AI Studio")
local button = toolbar:CreateButton("Projekt bauen", "Baut das Projekt aus der Web-Plattform", "rbxassetid://6031075931")

local MATERIALS = {
	Plastic = Enum.Material.Plastic, Wood = Enum.Material.Wood, Slate = Enum.Material.Slate,
	Concrete = Enum.Material.Concrete, Brick = Enum.Material.Brick, Sand = Enum.Material.Sand,
	Cobblestone = Enum.Material.Cobblestone, Metal = Enum.Material.Metal, Grass = Enum.Material.Grass,
	Ice = Enum.Material.Ice, Neon = Enum.Material.Neon, Glass = Enum.Material.Glass,
	Water = Enum.Material.Water, Fabric = Enum.Material.Fabric, Marble = Enum.Material.Marble,
	Granite = Enum.Material.Granite,
}

local SHAPES = {
	Ball = Enum.PartType.Ball, Block = Enum.PartType.Block,
	Cylinder = Enum.PartType.Cylinder, Wedge = Enum.PartType.Wedge,
	CornerWedge = Enum.PartType.CornerWedge,
}

local function toVector3(value)
	if type(value) == "table" and #value >= 3 then
		return Vector3.new(value[1], value[2], value[3])
	end
	return Vector3.new(0, 0, 0)
end

local function toCFrame(value)
	if type(value) ~= "table" or #value < 12 then
		return CFrame.new(0, 0, 0)
	end
	local x, y, z = value[1], value[2], value[3]
	local r00, r01, r02 = value[4], value[5], value[6]
	local r10, r11, r12 = value[7], value[8], value[9]
	local r20, r21, r22 = value[10], value[11], value[12]
	return CFrame.new(x, y, z, r00, r01, r02, r10, r11, r12, r20, r21, r22)
end

local function toColor(value)
	if type(value) == "table" and #value >= 3 then
		local r, g, b = value[1], value[2], value[3]
		if r <= 1 and g <= 1 and b <= 1 and (r + g + b) > 0 then
			return Color3.new(r, g, b)
		end
		return Color3.fromRGB(r, g, b)
	end
	return Color3.fromRGB(163, 162, 165)
end

local function applyProps(instance, props)
	local ok, err = pcall(function()
		if props.size then
			instance.Size = toVector3(props.size)
		end
		if props.cframe then
			instance.CFrame = toCFrame(props.cframe)
		end
		if props.color then
			instance.Color = toColor(props.color)
		end
		if props.colorFloat then
			instance.Color = toColor(props.colorFloat)
		end
		if props.anchored ~= nil and instance:IsA("BasePart") then
			instance.Anchored = props.anchored
		end
		if props.canCollide ~= nil and instance:IsA("BasePart") then
			instance.CanCollide = props.canCollide
		end
		if props.transparency ~= nil and instance:IsA("BasePart") then
			instance.Transparency = props.transparency
		end
		if props.material and instance:IsA("BasePart") then
			instance.Material = MATERIALS[props.material] or Enum.Material.Plastic
		end
		if props.shape and instance:IsA("Part") then
			instance.Shape = SHAPES[props.shape] or Enum.PartType.Block
		end
		if props.source and (instance:IsA("LuaSourceContainer")) then
			instance.Source = props.source
		end
		if props.brightness and instance:IsA("Light") then
			instance.Brightness = props.brightness
		end
		if props.range and instance:IsA("Light") then
			instance.Range = props.range
		end
		if props.actionText and instance:IsA("ProximityPrompt") then
			instance.ActionText = props.actionText
		end
		if props.objectText and instance:IsA("ProximityPrompt") then
			instance.ObjectText = props.objectText
		end
		if props.holdDuration and instance:IsA("ProximityPrompt") then
			instance.HoldDuration = props.holdDuration
		end
		if props.maxActivationDistance and instance:IsA("ProximityPrompt") then
			instance.MaxActivationDistance = props.maxActivationDistance
		end
		if props.requiresLineOfSight ~= nil and instance:IsA("ProximityPrompt") then
			instance.RequiresLineOfSight = props.requiresLineOfSight
		end
	end)
	if not ok then
		warn("[Roblox AI Studio] Eigenschaft übersprungen: " .. tostring(err))
	end
end

local created = 0

local function buildNode(node, parent)
	local className = node.c or "Folder"
	local instance
	local ok, err = pcall(function()
		instance = Instance.new(className)
	end)
	if not ok or not instance then
		warn("[Roblox AI Studio] Klasse nicht erzeugt: " .. tostring(className))
		return nil
	end

	instance.Name = node.n or className
	if node.p then
		applyProps(instance, node.p)
	end
	instance.Parent = parent
	created += 1

	for _, child in ipairs(node.k or {}) do
		buildNode(child, instance)
	end
	return instance
end

local function fetchPlan(serverUrl, projectId, token)
	local url = string.format("%s/api/plugin/build/%s?token=%s", serverUrl, projectId, token)
	local response = HttpService:RequestAsync({
		Url = url,
		Method = "GET",
		Headers = { Accept = "application/json" },
	})
	if not response.Success then
		error("Server antwortete mit " .. tostring(response.StatusCode))
	end
	return HttpService:JSONDecode(response.Body)
end

local function reportProgress(serverUrl, projectId, token, percent, step, message)
	pcall(function()
		HttpService:RequestAsync({
			Url = string.format("%s/api/plugin/progress", serverUrl),
			Method = "POST",
			Headers = { ["Content-Type"] = "application/json" },
			Body = HttpService:JSONEncode({
				projectId = projectId,
				token = token,
				percent = percent,
				step = step,
				message = message,
			}),
		})
	end)
end

local function buildFromPlan(serverUrl, projectId, token, target)
	local data = fetchPlan(serverUrl, projectId, token)
	if not data or not data.plan then
		error("Kein Bauplan erhalten.")
	end

	local recording = ChangeHistoryService:TryBeginRecording("Roblox AI Studio Build")
	created = 0
	reportProgress(serverUrl, projectId, token, 5, "Bauplan geladen", "Starte Aufbau in Studio")

	local roots = data.plan.roots or {}
	local built = {}
	for index, root in ipairs(roots) do
		local node = buildNode(root, target)
		if node then
			table.insert(built, node)
		end
		reportProgress(serverUrl, projectId, token, math.floor((index / math.max(1, #roots)) * 95),
			"Baue " .. tostring(root.n), string.format("%d Instanzen erzeugt", created))
	end

	if recording then
		ChangeHistoryService:FinishRecording(recording, Enum.FinishRecordingOperation.Commit)
	end
	Selection:Set(built)
	reportProgress(serverUrl, projectId, token, 100, "Fertig", string.format("%d Instanzen erzeugt", created))
	return created
end

local function makeUi()
	local widget = plugin:CreateDockWidgetPluginGui(
		"RobloxAIStudioWidget",
		DockWidgetPluginGuiInfo.new(Enum.InitialDockState.Right, false, false, 340, 460, 300, 320)
	)
	widget.Title = "Roblox AI Studio"

	local frame = Instance.new("Frame")
	frame.Size = UDim2.fromScale(1, 1)
	frame.BackgroundColor3 = Color3.fromRGB(15, 15, 28)
	frame.BorderSizePixel = 0
	frame.Parent = widget

	local layout = Instance.new("UIListLayout")
	layout.Padding = UDim.new(0, 8)
	layout.SortOrder = Enum.SortOrder.LayoutOrder
	layout.Parent = frame

	local padding = Instance.new("UIPadding")
	padding.PaddingTop = UDim.new(0, 12)
	padding.PaddingLeft = UDim.new(0, 12)
	padding.PaddingRight = UDim.new(0, 12)
	padding.Parent = frame

	local title = Instance.new("TextLabel")
	title.Text = "Roblox AI Studio"
	title.Font = Enum.Font.GothamBold
	title.TextSize = 16
	title.TextColor3 = Color3.fromRGB(236, 236, 250)
	title.BackgroundTransparency = 1
	title.Size = UDim2.new(1, 0, 0, 24)
	title.TextXAlignment = Enum.TextXAlignment.Left
	title.Parent = frame

	local function makeField(placeholder, defaultText, order)
		local box = Instance.new("TextBox")
		box.PlaceholderText = placeholder
		box.Text = defaultText or ""
		box.Font = Enum.Font.Code
		box.TextSize = 12
		box.TextColor3 = Color3.fromRGB(236, 236, 250)
		box.PlaceholderColor3 = Color3.fromRGB(140, 140, 170)
		box.BackgroundColor3 = Color3.fromRGB(24, 24, 42)
		box.BorderSizePixel = 0
		box.Size = UDim2.new(1, 0, 0, 30)
		box.TextXAlignment = Enum.TextXAlignment.Left
		box.LayoutOrder = order
		box.Parent = frame
		local corner = Instance.new("UICorner")
		corner.CornerRadius = UDim.new(0, 6)
		corner.Parent = box
		local pad = Instance.new("UIPadding")
		pad.PaddingLeft = UDim.new(0, 8)
		pad.Parent = box
		return box
	end

	local serverBox = makeField("https://deine-app.appjet.dev", "http://localhost:3000", 2)
	local projectBox = makeField("Projekt-ID", "", 3)
	local tokenBox = makeField("Token", "", 4)

	local status = Instance.new("TextLabel")
	status.Text = "Bereit."
	status.Font = Enum.Font.Gotham
	status.TextSize = 12
	status.TextColor3 = Color3.fromRGB(156, 156, 186)
	status.BackgroundTransparency = 1
	status.Size = UDim2.new(1, 0, 0, 40)
	status.TextWrapped = true
	status.TextYAlignment = Enum.TextYAlignment.Top
	status.TextXAlignment = Enum.TextXAlignment.Left
	status.LayoutOrder = 6
	status.Parent = frame

	local buildButton = Instance.new("TextButton")
	buildButton.Text = "Projekt bauen"
	buildButton.Font = Enum.Font.GothamBold
	buildButton.TextSize = 14
	buildButton.TextColor3 = Color3.fromRGB(255, 255, 255)
	buildButton.BackgroundColor3 = Color3.fromRGB(124, 92, 255)
	buildButton.BorderSizePixel = 0
	buildButton.Size = UDim2.new(1, 0, 0, 38)
	buildButton.LayoutOrder = 5
	buildButton.Parent = frame
	local buildCorner = Instance.new("UICorner")
	buildCorner.CornerRadius = UDim.new(0, 8)
	buildCorner.Parent = buildButton

	buildButton.MouseButton1Click:Connect(function()
		local serverUrl = serverBox.Text:gsub("/+$", "")
		local projectId = projectBox.Text
		local token = tokenBox.Text
		if projectId == "" then
			status.Text = "Bitte eine Projekt-ID einfügen."
			return
		end

		buildButton.Text = "Baue …"
		status.Text = "Lade Bauplan vom Server …"
		task.spawn(function()
			local ok, result = pcall(function()
				local target = workspace:FindFirstChild("RobloxAIStudio_Build")
				if target then
					target:Destroy()
				end
				target = Instance.new("Model")
				target.Name = "RobloxAIStudio_Build"
				target.Parent = workspace
				return buildFromPlan(serverUrl, projectId, token, target)
			end)
			buildButton.Text = "Projekt bauen"
			if ok then
				status.Text = string.format("Fertig: %d Instanzen erzeugt.", result)
			else
				status.Text = "Fehler: " .. tostring(result)
			end
		end)
	end)

	return widget
end

local widget = makeUi()

button.Click:Connect(function()
	widget.Enabled = not widget.Enabled
end)
