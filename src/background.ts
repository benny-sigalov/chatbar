type ChromeRuntime = {
  runtime?: {
    onInstalled?: {
      addListener(callback: () => void): void
    }
    onStartup?: {
      addListener(callback: () => void): void
    }
  }
  tabs?: {
    query(queryInfo: { active: boolean; currentWindow: boolean }): Promise<Array<{ id?: number }>>
  }
  action?: {
    onClicked?: {
      addListener(callback: (tab: { id?: number; windowId?: number }) => void): void
    }
  }
  sidePanel?: {
    setOptions?(options: {
      tabId?: number
      path: string
      enabled: boolean
    }): Promise<void>
    setPanelBehavior?(options: { openPanelOnActionClick: boolean }): Promise<void>
  }
}

const chromeApi = (globalThis as unknown as { chrome?: ChromeRuntime }).chrome
const chatGptSidePanelUrl = 'https://chatgpt.com/'

async function setChatGptSidePanelPath(tabId?: number): Promise<void> {
  await chromeApi?.sidePanel?.setOptions?.({
    tabId,
    path: chatGptSidePanelUrl,
    enabled: true,
  })
}

async function setChatGptPathForActiveTab(): Promise<void> {
  const tabs = await chromeApi?.tabs?.query({ active: true, currentWindow: true })
  await setChatGptSidePanelPath(tabs?.[0]?.id)
}

async function enableDefaultActionSidePanelOpen(): Promise<void> {
  await chromeApi?.sidePanel?.setPanelBehavior?.({
    openPanelOnActionClick: true,
  })
}

async function configureChatBarSidePanel(): Promise<void> {
  await enableDefaultActionSidePanelOpen()
  await setChatGptPathForActiveTab()
}

chromeApi?.runtime?.onInstalled?.addListener(() => {
  void configureChatBarSidePanel()
})

chromeApi?.runtime?.onStartup?.addListener(() => {
  void configureChatBarSidePanel()
})

chromeApi?.action?.onClicked?.addListener((tab) => {
  void setChatGptSidePanelPath(tab.id).catch((error: unknown) => {
    console.error('Failed to set ChatGPT as ChatBar side panel path:', error)
  })
})
