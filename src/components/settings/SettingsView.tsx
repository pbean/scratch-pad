import { useState, useEffect } from "react"
import { useScratchPadStore } from "../../lib/store"
import { Button } from "../ui/button"
import { Input } from "../ui/input"
import { Label } from "../ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card"
import { Separator } from "../ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs"
import { ArrowLeft, Download, Upload, RotateCcw, Save, AlertCircle, Activity, BarChart3 } from "lucide-react"
import type { SettingsFormData, NoteFormat, LayoutMode } from "../../types"
import PerformanceDashboard from "../performance/PerformanceDashboard"
import PerformanceAlertManager from "../performance/PerformanceAlertManager"
import OptimizationRecommendations from "../performance/OptimizationRecommendations"

export function SettingsView() {
  const { 
    setCurrentView, 
    getAllSettings, 
    setSetting, 
    exportSettings, 
    importSettings, 
    resetSettingsToDefaults,
    error,
    setError
  } = useScratchPadStore()

  const [formData, setFormData] = useState<SettingsFormData>({
    globalShortcut: "",
    uiFont: "",
    editorFont: "",
    defaultNoteFormat: "plaintext",
    layoutMode: "default",
    windowWidth: "",
    windowHeight: "",
    autoSaveDelay: "",
    searchLimit: "",
    fuzzySearchThreshold: ""
  })

  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({})
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  // Load settings on component mount
  useEffect(() => {
    loadSettings()
  }, [])

  const loadSettings = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const settings = await getAllSettings()
      
      setFormData({
        globalShortcut: settings.global_shortcut || "Ctrl+Shift+N",
        uiFont: settings.ui_font || "Inter",
        editorFont: settings.editor_font || "SauceCodePro Nerd Font",
        defaultNoteFormat: (settings.default_note_format as NoteFormat) || "plaintext",
        layoutMode: (settings.layout_mode as LayoutMode) || "default",
        windowWidth: settings.window_width || "800",
        windowHeight: settings.window_height || "600",
        autoSaveDelay: settings.auto_save_delay_ms || "500",
        searchLimit: settings.search_limit || "100",
        fuzzySearchThreshold: settings.fuzzy_search_threshold || "0.6"
      })
    } catch (error) {
      console.error("Failed to load settings:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {}

    // Validate global shortcut
    if (!formData.globalShortcut.trim()) {
      errors.globalShortcut = "Global shortcut cannot be empty"
    }

    // Validate numeric fields
    if (formData.windowWidth) {
      const windowWidth = parseInt(formData.windowWidth)
      if (isNaN(windowWidth) || windowWidth < 400 || windowWidth > 3840) {
        errors.windowWidth = "Window width must be between 400 and 3840 pixels"
      }
    }

    if (formData.windowHeight) {
      const windowHeight = parseInt(formData.windowHeight)
      if (isNaN(windowHeight) || windowHeight < 300 || windowHeight > 2160) {
        errors.windowHeight = "Window height must be between 300 and 2160 pixels"
      }
    }

    if (formData.autoSaveDelay) {
      const autoSaveDelay = parseInt(formData.autoSaveDelay)
      if (isNaN(autoSaveDelay) || autoSaveDelay < 100 || autoSaveDelay > 10000) {
        errors.autoSaveDelay = "Auto-save delay must be between 100 and 10000 milliseconds"
      }
    }

    if (formData.searchLimit) {
      const searchLimit = parseInt(formData.searchLimit)
      if (isNaN(searchLimit) || searchLimit < 10 || searchLimit > 1000) {
        errors.searchLimit = "Search limit must be between 10 and 1000"
      }
    }

    if (formData.fuzzySearchThreshold) {
      const fuzzyThreshold = parseFloat(formData.fuzzySearchThreshold)
      if (isNaN(fuzzyThreshold) || fuzzyThreshold < 0 || fuzzyThreshold > 1) {
        errors.fuzzySearchThreshold = "Fuzzy search threshold must be between 0.0 and 1.0"
      }
    }

    setValidationErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleSave = async () => {
    if (!validateForm()) {
      return
    }

    setIsSaving(true)
    setError(null)
    setSuccessMessage(null)

    try {
      // Save all settings
      await setSetting("global_shortcut", formData.globalShortcut)
      if (formData.uiFont) await setSetting("ui_font", formData.uiFont)
      if (formData.editorFont) await setSetting("editor_font", formData.editorFont)
      await setSetting("default_note_format", formData.defaultNoteFormat)
      if (formData.layoutMode) await setSetting("layout_mode", formData.layoutMode)
      if (formData.windowWidth) await setSetting("window_width", formData.windowWidth)
      if (formData.windowHeight) await setSetting("window_height", formData.windowHeight)
      if (formData.autoSaveDelay) await setSetting("auto_save_delay_ms", formData.autoSaveDelay)
      if (formData.searchLimit) await setSetting("search_limit", formData.searchLimit)
      if (formData.fuzzySearchThreshold) await setSetting("fuzzy_search_threshold", formData.fuzzySearchThreshold)

      setSuccessMessage("Settings saved successfully!")
      setTimeout(() => setSuccessMessage(null), 3000)
    } catch (error) {
      console.error("Failed to save settings:", error)
    } finally {
      setIsSaving(false)
    }
  }

  const handleExport = async () => {
    try {
      const settingsJson = await exportSettings()
      
      // Create and download file
      const blob = new Blob([settingsJson], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'scratch-pad-settings.json'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      setSuccessMessage("Settings exported successfully!")
      setTimeout(() => setSuccessMessage(null), 3000)
    } catch (error) {
      console.error("Failed to export settings:", error)
    }
  }

  const handleImport = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json'
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) return

      try {
        const content = await file.text()
        const count = await importSettings(content)
        
        // Reload settings after import
        await loadSettings()
        
        setSuccessMessage(`Successfully imported ${count} settings!`)
        setTimeout(() => setSuccessMessage(null), 3000)
      } catch (error) {
        console.error("Failed to import settings:", error)
        setError("Failed to import settings. Please check the file format.")
      }
    }
    input.click()
  }

  const handleReset = async () => {
    if (!confirm("Are you sure you want to reset all settings to their default values? This action cannot be undone.")) {
      return
    }

    try {
      await resetSettingsToDefaults()
      await loadSettings()
      
      setSuccessMessage("Settings reset to defaults successfully!")
      setTimeout(() => setSuccessMessage(null), 3000)
    } catch (error) {
      console.error("Failed to reset settings:", error)
    }
  }

  const handleInputChange = (field: keyof SettingsFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    
    // Clear validation error for this field
    if (validationErrors[field]) {
      setValidationErrors(prev => {
        const newErrors = { ...prev }
        delete newErrors[field]
        return newErrors
      })
    }
  }

  if (isLoading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p style={{ color: 'hsl(var(--muted-foreground))' }}>Loading settings...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-screen w-screen overflow-auto" style={{ backgroundColor: 'hsl(var(--background))' }}>
      <div className="max-w-6xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setCurrentView("note")}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Notes
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Settings</h1>
            <p style={{ color: 'hsl(var(--muted-foreground))' }}>
              Configure your scratch-pad application preferences
            </p>
          </div>
        </div>

        {/* Success/Error Messages */}
        {successMessage && (
          <div className="bg-green-50 border border-green-200 rounded-md p-4 flex items-center gap-2">
            <div className="h-4 w-4 text-green-600">✓</div>
            <span className="text-green-800">{successMessage}</span>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-md p-4 flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-red-600" />
            <span className="text-red-800">{error}</span>
          </div>
        )}

        {/* Main Settings Tabs */}
        <Tabs defaultValue="general" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="general">General</TabsTrigger>
            <TabsTrigger value="performance">Performance</TabsTrigger>
            <TabsTrigger value="monitoring">Monitoring</TabsTrigger>
            <TabsTrigger value="optimization">Optimization</TabsTrigger>
          </TabsList>

          {/* General Settings Tab */}
          <TabsContent value="general" className="space-y-6">
            {/* Global Shortcut Settings */}
            <Card>
              <CardHeader>
                <CardTitle>Global Shortcut</CardTitle>
                <CardDescription>
                  Configure the keyboard shortcut to show/hide the application
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="globalShortcut">Global Shortcut</Label>
                  <Input
                    id="globalShortcut"
                    value={formData.globalShortcut}
                    onChange={(e) => handleInputChange("globalShortcut", e.target.value)}
                    placeholder="e.g., Ctrl+Shift+N"
                    className={validationErrors.globalShortcut ? "border-red-500" : ""}
                  />
                  {validationErrors.globalShortcut && (
                    <p className="text-sm text-red-600">{validationErrors.globalShortcut}</p>
                  )}
                  <p className="text-sm" style={{ color: 'hsl(var(--muted-foreground))' }}>
                    Use standard modifier keys: Ctrl, Alt, Shift, Cmd (macOS)
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Font Settings */}
            <Card>
              <CardHeader>
                <CardTitle>Font Preferences</CardTitle>
                <CardDescription>
                  Configure fonts for the user interface and text editor
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="uiFont" id="uiFont-label">UI Font</Label>
                    <Select value={formData.uiFont} onValueChange={(value) => handleInputChange("uiFont", value)}>
                      <SelectTrigger id="uiFont" aria-labelledby="uiFont-label">
                        <SelectValue placeholder="Select UI font" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Inter">Inter</SelectItem>
                        <SelectItem value="system-ui">System UI</SelectItem>
                        <SelectItem value="Arial">Arial</SelectItem>
                        <SelectItem value="Helvetica">Helvetica</SelectItem>
                        <SelectItem value="sans-serif">Sans Serif</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="editorFont" id="editorFont-label">Editor Font</Label>
                    <Select value={formData.editorFont} onValueChange={(value) => handleInputChange("editorFont", value)}>
                      <SelectTrigger id="editorFont" aria-labelledby="editorFont-label">
                        <SelectValue placeholder="Select editor font" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="SauceCodePro Nerd Font">SauceCodePro Nerd Font</SelectItem>
                        <SelectItem value="Fira Code">Fira Code</SelectItem>
                        <SelectItem value="JetBrains Mono">JetBrains Mono</SelectItem>
                        <SelectItem value="Monaco">Monaco</SelectItem>
                        <SelectItem value="Consolas">Consolas</SelectItem>
                        <SelectItem value="monospace">Monospace</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Note Format and Layout Settings */}
            <Card>
              <CardHeader>
                <CardTitle>Note Format & Layout</CardTitle>
                <CardDescription>
                  Configure default note format and window layout preferences
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="defaultNoteFormat" id="defaultNoteFormat-label">Default Note Format</Label>
                    <Select value={formData.defaultNoteFormat} onValueChange={(value) => handleInputChange("defaultNoteFormat", value as NoteFormat)}>
                      <SelectTrigger id="defaultNoteFormat" aria-labelledby="defaultNoteFormat-label">
                        <SelectValue placeholder="Select note format" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="plaintext">Plain Text</SelectItem>
                        <SelectItem value="markdown">Markdown</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="layoutMode" id="layoutMode-label">Layout Mode</Label>
                    <Select value={formData.layoutMode} onValueChange={(value) => handleInputChange("layoutMode", value as LayoutMode)}>
                      <SelectTrigger id="layoutMode" aria-labelledby="layoutMode-label">
                        <SelectValue placeholder="Select layout mode" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="default">Default</SelectItem>
                        <SelectItem value="half">Half Screen</SelectItem>
                        <SelectItem value="full">Full Screen</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Window Settings */}
            <Card>
              <CardHeader>
                <CardTitle>Window Settings</CardTitle>
                <CardDescription>
                  Configure window dimensions and behavior
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="windowWidth">Window Width (px)</Label>
                    <Input
                      id="windowWidth"
                      type="number"
                      value={formData.windowWidth}
                      onChange={(e) => handleInputChange("windowWidth", e.target.value)}
                      min="400"
                      max="3840"
                      className={validationErrors.windowWidth ? "border-red-500" : ""}
                    />
                    {validationErrors.windowWidth && (
                      <p className="text-sm text-red-600">{validationErrors.windowWidth}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="windowHeight">Window Height (px)</Label>
                    <Input
                      id="windowHeight"
                      type="number"
                      value={formData.windowHeight}
                      onChange={(e) => handleInputChange("windowHeight", e.target.value)}
                      min="300"
                      max="2160"
                      className={validationErrors.windowHeight ? "border-red-500" : ""}
                    />
                    {validationErrors.windowHeight && (
                      <p className="text-sm text-red-600">{validationErrors.windowHeight}</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Performance Settings */}
            <Card>
              <CardHeader>
                <CardTitle>Performance Settings</CardTitle>
                <CardDescription>
                  Configure auto-save and search performance settings
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="autoSaveDelay">Auto-save Delay (ms)</Label>
                    <Input
                      id="autoSaveDelay"
                      type="number"
                      value={formData.autoSaveDelay}
                      onChange={(e) => handleInputChange("autoSaveDelay", e.target.value)}
                      min="100"
                      max="10000"
                      className={validationErrors.autoSaveDelay ? "border-red-500" : ""}
                    />
                    {validationErrors.autoSaveDelay && (
                      <p className="text-sm text-red-600">{validationErrors.autoSaveDelay}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="searchLimit">Search Results Limit</Label>
                    <Input
                      id="searchLimit"
                      type="number"
                      value={formData.searchLimit}
                      onChange={(e) => handleInputChange("searchLimit", e.target.value)}
                      min="10"
                      max="1000"
                      className={validationErrors.searchLimit ? "border-red-500" : ""}
                    />
                    {validationErrors.searchLimit && (
                      <p className="text-sm text-red-600">{validationErrors.searchLimit}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="fuzzySearchThreshold">Fuzzy Search Threshold</Label>
                    <Input
                      id="fuzzySearchThreshold"
                      type="number"
                      step="0.1"
                      value={formData.fuzzySearchThreshold}
                      onChange={(e) => handleInputChange("fuzzySearchThreshold", e.target.value)}
                      min="0"
                      max="1"
                      className={validationErrors.fuzzySearchThreshold ? "border-red-500" : ""}
                    />
                    {validationErrors.fuzzySearchThreshold && (
                      <p className="text-sm text-red-600">{validationErrors.fuzzySearchThreshold}</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Action Buttons */}
            <div className="flex flex-wrap gap-4 pt-6 border-t">
              <Button onClick={handleSave} disabled={isSaving} className="flex items-center gap-2">
                <Save className="h-4 w-4" />
                {isSaving ? "Saving..." : "Save Settings"}
              </Button>

              <Separator orientation="vertical" className="h-8" />

              <Button variant="outline" onClick={handleExport} className="flex items-center gap-2">
                <Download className="h-4 w-4" />
                Export Settings
              </Button>

              <Button variant="outline" onClick={handleImport} className="flex items-center gap-2">
                <Upload className="h-4 w-4" />
                Import Settings
              </Button>

              <Separator orientation="vertical" className="h-8" />

              <Button variant="destructive" onClick={handleReset} className="flex items-center gap-2">
                <RotateCcw className="h-4 w-4" />
                Reset to Defaults
              </Button>
            </div>
          </TabsContent>

          {/* Performance Dashboard Tab */}
          <TabsContent value="performance" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5" />
                  Performance Dashboard
                </CardTitle>
                <CardDescription>
                  Monitor application performance and system metrics in real-time
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <PerformanceDashboard />
              </CardContent>
            </Card>
          </TabsContent>

          {/* Monitoring Tab */}
          <TabsContent value="monitoring" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertCircle className="h-5 w-5" />
                  Performance Alerts
                </CardTitle>
                <CardDescription>
                  Manage performance alerts and notification settings
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <PerformanceAlertManager />
              </CardContent>
            </Card>
          </TabsContent>

          {/* Optimization Tab */}
          <TabsContent value="optimization" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  Optimization Recommendations
                </CardTitle>
                <CardDescription>
                  AI-powered suggestions to improve application performance
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <OptimizationRecommendations />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}