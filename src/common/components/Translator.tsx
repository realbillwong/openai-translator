import React, { useCallback, useEffect, useLayoutEffect, useMemo, useReducer, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import toast from 'react-hot-toast/headless'
import { Client as Styletron } from 'styletron-engine-atomic'
import { Provider as StyletronProvider } from 'styletron-react'
import { BaseProvider } from 'baseui-sd'
import { Textarea } from 'baseui-sd/textarea'
import { createUseStyles } from 'react-jss'
import { TbArrowsExchange } from 'react-icons/tb'
import * as mdIcons from 'react-icons/md'
import { detectLang, getLangConfig, sourceLanguages, targetLanguages, LangCode } from '../lang'
import { translate, TranslateMode } from '../translate'
import { Select, Value, Option } from 'baseui-sd/select'
import { RxEraser, RxReload, RxStop } from 'react-icons/rx'
import { clsx } from 'clsx'
import { Button } from 'baseui-sd/button'
import { ErrorBoundary } from 'react-error-boundary'
import { ErrorFallback } from '../components/ErrorFallback'
import { isDesktopApp, isMacOS } from '../utils'
import { InnerSettings } from './Settings'
import { containerID, popupCardInnerContainerId } from '../../browser-extension/content_script/consts'
import { HighlightInTextarea } from '../highlight-in-textarea'
import { LRUCache } from 'lru-cache'
import { ISettings, IThemedStyleProps } from '../types'
import { useTheme } from '../hooks/useTheme'
import { Tooltip } from './Tooltip'
import { useSettings } from '../hooks/useSettings'
import { Action } from '../internal-services/db'
import { CopyButton } from './CopyButton'
import { useLiveQuery } from 'dexie-react-hooks'
import { actionService } from '../services/action'
import { IoIosRocket } from 'react-icons/io'
import 'katex/dist/katex.min.css'
import Latex from 'react-latex-next'
import { Markdown } from './Markdown'
import useResizeObserver from 'use-resize-observer'
import _ from 'underscore'
import { GlobalSuspense } from './GlobalSuspense'
import { type LogoWithTextRef } from './LogoWithText'
import Toaster from './Toaster'
import { useDeepCompareCallback } from 'use-deep-compare'
import { useTranslatorStore } from '../store'
import { useAtom } from 'jotai'
import { SpeakerIcon } from './SpeakerIcon'
import { Provider, getEngine } from '../engines'
import { showSettingsAtom } from '../store/setting'

const cache = new LRUCache({
    max: 500,
    maxSize: 5000,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    sizeCalculation: (_value, _key) => {
        return 1
    },
})

function genLangOptions(langs: [LangCode, string][]): Value {
    return langs.reduce((acc, [id, label]) => {
        return [
            ...acc,
            {
                id,
                label,
            } as Option,
        ]
    }, [] as Value)
}
const sourceLangOptions = genLangOptions(sourceLanguages)
const targetLangOptions = genLangOptions(targetLanguages)

const useStyles = createUseStyles({
    'popupCard': {
        height: '100%',
        boxSizing: 'border-box',
    },
    'footer': (props: IThemedStyleProps) => ({
        boxSizing: 'border-box',
        color: props.theme.colors.contentSecondary,
        position: 'fixed',
        width: '100%',
        height: '42px',
        left: '0',
        bottom: '0',
        paddingLeft: '6px',
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        backdropFilter: 'blur(10px)',
    }),
    'poweredBy': (props: IThemedStyleProps) => ({
        fontSize: props.theme.sizing.scale300,
        color: props.theme.colors.contentInverseTertiary,
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        gap: '4px',
    }),
    'brand': {
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        gap: '3px',
    },
    'popupCardHeaderContainer': (props: IThemedStyleProps) =>
        props.isDesktopApp
            ? {
                  'position': 'fixed',
                  'backdropFilter': 'blur(10px)',
                  'zIndex': 1,
                  'left': 0,
                  'top': 0,
                  'width': '100%',
                  'boxSizing': 'border-box',
                  'padding': isMacOS ? '30px 16px 8px' : '8px 16px',
                  'background': props.themeType === 'dark' ? 'rgba(31, 31, 31, 0.5)' : 'rgba(255, 255, 255, 0.5)',
                  'display': 'flex',
                  'flexDirection': 'row',
                  'flexFlow': 'row nowrap',
                  'cursor': 'move',
                  'alignItems': 'center',
                  'borderBottom': `1px solid ${props.theme.colors.borderTransparent}`,
                  '-ms-user-select': 'none',
                  '-webkit-user-select': 'none',
                  'user-select': 'none',
              }
            : {
                  'display': 'flex',
                  'flexDirection': 'row',
                  'cursor': 'move',
                  'alignItems': 'center',
                  'padding': '8px 16px',
                  'borderBottom': `1px solid ${props.theme.colors.borderTransparent}`,
                  '-ms-user-select': 'none',
                  '-webkit-user-select': 'none',
                  'user-select': 'none',
              },
    'paragraph': {
        'margin': '0.5em 0',
        '-ms-user-select': 'text',
        '-webkit-user-select': 'text',
        'user-select': 'text',
    },
    'popupCardHeaderButtonGroup': (props: IThemedStyleProps) => ({
        'display': 'flex',
        'flexDirection': 'row',
        'alignItems': 'center',
        'gap': '5px',
        'marginLeft': '10px',
        '@media screen and (max-width: 460px)': {
            marginLeft: props.isDesktopApp ? '5px' : undefined,
        },
    }),
    'popupCardHeaderMoreActionsContainer': () => ({
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        marginLeft: 5,
    }),
    'popupCardHeaderMoreActionsBtn': (props: IThemedStyleProps) => ({
        'cursor': 'pointer',
        '& *': {
            fill: props.theme.colors.contentPrimary,
            color: props.theme.colors.contentPrimary,
            stroke: props.theme.colors.contentPrimary,
        },
    }),
    'popupCardHeaderActionsContainer': (props: IThemedStyleProps) => ({
        'box-sizing': 'border-box',
        'display': 'flex',
        'flexShrink': 0,
        'flexDirection': 'row',
        'alignItems': 'center',
        'padding': props.showLogo ? '5px 10px' : '5px 10px 5px 0px',
        'gap': '10px',
        '@media screen and (max-width: 460px)': {
            padding: props.isDesktopApp ? '5px 0' : undefined,
            gap: props.isDesktopApp ? '5px' : undefined,
        },
    }),
    'from': {
        display: 'flex',
        color: '#999',
        fontSize: '12px',
        flexShrink: 0,
    },
    'arrow': {
        display: 'flex',
        color: '#999',
        cursor: 'pointer',
    },
    'to': {
        display: 'flex',
        color: '#999',
        fontSize: '12px',
        flexShrink: 0,
    },
    'popupCardContentContainer': (props: IThemedStyleProps) => ({
        paddingTop: props.isDesktopApp ? '52px' : undefined,
        display: 'flex',
        flexDirection: 'column',
    }),
    'loadingContainer': {
        margin: '0 auto',
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        gap: '10px',
    },
    'popupCardEditorContainer': {
        display: 'flex',
        flexDirection: 'column',
        padding: '16px',
    },
    'popupCardTranslatedContainer': (props: IThemedStyleProps) => ({
        'position': 'relative',
        'padding': '26px 16px 16px 16px',
        'border-top': `1px solid ${props.theme.colors.borderTransparent}`,
        '-ms-user-select': 'none',
        '-webkit-user-select': 'none',
        'user-select': 'none',
    }),
    'tokenCount': {
        color: '#999',
        fontSize: '14px',
        fontFamily: 'monospace',
    },
    'actionStr': (props: IThemedStyleProps) => ({
        position: 'absolute',
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        gap: '6px',
        top: '0',
        left: '50%',
        transform: 'translateX(-50%) translateY(-50%)',
        fontSize: '10px',
        padding: '2px 12px',
        borderRadius: '4px',
        background: props.theme.colors.backgroundTertiary,
        color: props.theme.colors.contentSecondary,
    }),
    'error': {
        background: '#f8d7da',
    },
    'caret': {
        marginLeft: '4px',
        borderRight: '0.2em solid #777',
        animation: '$caret 500ms steps(44) infinite',
    },
    '@keyframes caret': {
        '50%': {
            borderColor: 'transparent',
        },
    },
    'popupCardTranslatedContentContainer': (props: IThemedStyleProps) => ({
        'marginTop': '-14px',
        'display': 'flex',
        'overflowY': 'auto',
        'color': props.themeType === 'dark' ? props.theme.colors.contentSecondary : props.theme.colors.contentPrimary,
        '& *': {
            '-ms-user-select': 'text',
            '-webkit-user-select': 'text',
            'user-select': 'text',
        },
        '& > div': {
            width: '100%',
        },
    }),
    'errorMessage': {
        'display': 'flex',
        'color': 'red',
        'alignItems': 'center',
        'gap': '4px',
        '& *': {
            '-ms-user-select': 'text',
            '-webkit-user-select': 'text',
            'user-select': 'text',
        },
    },
    'actionButtonsContainer': {
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        gap: '12px',
    },
    'actionButton': (props: IThemedStyleProps) => ({
        color: props.theme.colors.contentSecondary,
        cursor: 'pointer',
        display: 'flex',
        paddingTop: '6px',
        paddingBottom: '6px',
    }),
    'actionButtonDisabled': (props: IThemedStyleProps) => ({
        color: props.theme.colors.buttonDisabledText,
        cursor: 'default',
        display: 'flex',
        paddingTop: '6px',
        paddingBottom: '6px',
    }),
    'enterHint': {
        color: '#999',
        fontSize: '14px',
        transform: 'scale(0.9)',
        marginRight: '-16px',
    },
    'writing': {
        'marginLeft': '3px',
        'width': '10px',
        '&::after': {
            content: '"✍️"',
            animation: '$writing 1.3s infinite',
        },
    },
    '@keyframes writing': {
        '50%': {
            marginLeft: '-3px',
            marginBottom: '-3px',
        },
    },
    'dropZone': (props: IThemedStyleProps) => ({
        'display': 'flex',
        'flexDirection': 'column',
        'alignItems': 'center',
        'justifyContent': 'center',
        'padding-left': '3px',
        'padding-right': '3px',
        'borderRadius': '0.75rem',
        'cursor': 'pointer',
        '-ms-user-select': 'none',
        '-webkit-user-select': 'none',
        'user-select': 'none',
        'border': `1px dashed ${props.theme.colors.borderTransparent}`,
        'background': props.theme.colors.backgroundTertiary,
        'color': props.theme.colors.contentSecondary,
    }),
    'fileDragArea': (props: IThemedStyleProps) => ({
        padding: '10px',
        display: 'flex',
        justifyContent: 'center',
        marginBottom: '10px',
        fontSize: '11px',
        border: `2px dashed ${props.theme.colors.borderTransparent}`,
        background: props.theme.colors.backgroundTertiary,
        color: props.theme.colors.contentSecondary,
    }),
    'OCRStatusBar': (props: IThemedStyleProps) => ({
        color: props.theme.colors.contentSecondary,
    }),
    'vocabulary': {
        position: 'fixed',
        width: '100%',
        height: '100%',
        top: 0,
        left: 0,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        background: 'rgba(0,0,0,0.3)',
    },
    'flexPlaceHolder': {
        marginRight: 'auto',
    },
    'popupCardContentContainerBackgroundBlur': {
        'height': '100vh',
        'boxSizing': 'border-box',
        'overflow': 'auto',
        'paddingTop': isMacOS ? '82px !important' : '58px !important',
        'paddingBottom': '42px',
        'scrollbarWidth': 'none',
        '&::-webkit-scrollbar': {
            display: 'none',
        },
        'mask': 'linear-gradient(180deg, #0000 58px, #000f 72px, #000f calc(100% - 60px), #0000 calc(100% - 40px));',
    },
})

interface IActionStrItem {
    beforeStr: string
    afterStr: string
}

const actionStrItems: Record<TranslateMode, IActionStrItem> = {
    'analyze': {
        beforeStr: 'Analyzing...',
        afterStr: 'Analyzed',
    },
    'polishing': {
        beforeStr: 'Polishing...',
        afterStr: 'Polished',
    },
    'translate': {
        beforeStr: 'Translating...',
        afterStr: 'Translated',
    },
    'summarize': {
        beforeStr: 'Summarizing...',
        afterStr: 'Summarized',
    },
    'explain-code': {
        beforeStr: 'Explaining...',
        afterStr: 'Explained',
    },
    'big-bang': {
        beforeStr: 'Writing...',
        afterStr: 'Written',
    },
}

export interface MovementXY {
    x: number
    y: number
}

export interface IInnerTranslatorProps {
    uuid?: string
    writing?: boolean
    autoFocus?: boolean
    showSettingsIcon?: boolean
    showSettings?: boolean
    defaultShowSettings?: boolean
    containerStyle?: React.CSSProperties
    editorRows?: number
    showLogo?: boolean
    onSettingsSave?: (oldSettings: ISettings) => void
    onSettingsShow?: (isShow: boolean) => void
    onAuthError?: () => void
}

export interface ITranslatorProps extends IInnerTranslatorProps {
    engine: Styletron
}

export function Translator(props: ITranslatorProps) {
    const { theme } = useTheme()

    return (
        <ErrorBoundary FallbackComponent={ErrorFallback}>
            <div>
                <StyletronProvider value={props.engine}>
                    <BaseProvider theme={theme}>
                        <GlobalSuspense>
                            <InnerTranslator {...props} />
                        </GlobalSuspense>
                    </BaseProvider>
                </StyletronProvider>
            </div>
        </ErrorBoundary>
    )
}

function InnerTranslator(props: IInnerTranslatorProps) {
    const [showSettings, setShowSettings] = useAtom(showSettingsAtom)

    useEffect(() => {
        setShowSettings(props.showSettings ?? false)
    }, [props.showSettings, props.uuid, setShowSettings])

    const { onSettingsShow } = props

    useEffect(() => {
        onSettingsShow?.(showSettings)
    }, [onSettingsShow, showSettings])

    const { showLogo = true } = props

    const [refreshActionsFlag] = useReducer((x: number) => x + 1, 0)

    const [translationFlag, forceTranslate] = useReducer((x: number) => x + 1, 0)

    const editorRef = useRef<HTMLTextAreaElement>(null)
    const isCompositing = useRef(false)
    const [selectedWord, setSelectedWord] = useState('')
    const [vocabularyType] = useState<'hide' | 'vocabulary' | 'article'>('hide')
    const highlightRef = useRef<HighlightInTextarea | null>(null)
    const { t, i18n } = useTranslation()
    const { settings } = useSettings()

    useEffect(() => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if (settings?.i18n !== (i18n as any).language) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            ;(i18n as any).changeLanguage(settings?.i18n)
        }
    }, [i18n, settings.i18n])

    useEffect(() => {
        if (!settings) {
            return
        }
        const engine = getEngine(settings.provider)
        engine.getModel().then((model) => {
            setTranslateDeps((prev) => {
                return {
                    ...prev,
                    provider: settings.provider,
                    engineModel: model,
                }
            })
        })
    }, [settings])

    const [autoFocus, setAutoFocus] = useState(false)

    useEffect(() => {
        if (highlightRef.current) {
            if (props.autoFocus) {
                setAutoFocus(false)
                setTimeout(() => {
                    setAutoFocus(true)
                }, 500)
            }
            return
        }
        const editor = editorRef.current
        if (!editor) {
            return undefined
        }
        highlightRef.current = new HighlightInTextarea(editor, { highlight: '' })
        if (props.autoFocus) {
            editor.focus()
        }
    }, [props.autoFocus])

    useEffect(() => {
        const editor = editorRef.current
        if (!editor) {
            return undefined
        }
        editor.focus()
        editor.spellcheck = false
    }, [props.uuid, showSettings])

    const [highlightWords, setHighlightWords] = useState<string[]>([])

    useEffect(() => {
        if (!highlightRef.current?.highlight) {
            return
        }
        if (selectedWord) {
            highlightRef.current.highlight.highlight = [selectedWord]
        } else {
            highlightRef.current.highlight.highlight = [...highlightWords]
        }
        highlightRef.current.handleInput()
    }, [selectedWord, highlightWords])

    const [activateAction, setActivateAction] = useState<Action>()

    const currentTranslateMode = useMemo(() => {
        editorRef.current?.focus()
        if (!activateAction) {
            return undefined
        }
        return activateAction.mode
    }, [activateAction])

    useLiveQuery(async () => {
        if (settings?.defaultTranslateMode && settings.defaultTranslateMode !== 'nop') {
            let action: Action | undefined
            const actionID = parseInt(settings.defaultTranslateMode, 10)
            if (isNaN(actionID)) {
                action = await actionService.getByMode(settings.defaultTranslateMode)
            } else {
                action = await actionService.get(actionID)
            }
            setActivateAction(action)
        }
    }, [settings.defaultTranslateMode])

    const headerRef = useRef<HTMLDivElement>(null)
    const { width: headerWidth = 0 } = useResizeObserver<HTMLDivElement>({ ref: headerRef })
    const logoWithTextRef = useRef<LogoWithTextRef>(null)
    const languagesSelectorRef = useRef<HTMLDivElement>(null)
    const { width: languagesSelectorWidth = 0 } = useResizeObserver<HTMLDivElement>({ ref: languagesSelectorRef })
    const headerActionButtonsRef = useRef<HTMLDivElement>(null)
    const { width: headerActionButtonsWidth = 0 } = useResizeObserver<HTMLDivElement>({ ref: headerActionButtonsRef })
    const containerRef = useRef<HTMLDivElement>(null)
    const editorContainerRef = useRef<HTMLDivElement>(null)
    const translatedContainerRef = useRef<HTMLDivElement>(null)
    const translatedContentRef = useRef<HTMLDivElement>(null)
    const actionButtonsRef = useRef<HTMLDivElement>(null)

    const hasActivateAction = activateAction !== undefined
    const [displayedActionsMaxCount, setDisplayedActionsMaxCount] = useState(4)

    useLayoutEffect(() => {
        const handleResize = () => {
            const headerElem = headerRef.current
            if (!headerElem) {
                return
            }
            const logoWithTextElem = logoWithTextRef.current
            const activateActionElem = headerElem.querySelector('.__gptedit-activate-action')
            if (hasActivateAction && !activateActionElem) {
                return
            }
            const paddingWidth = 32
            const logoWidth = showLogo ? 131 : 0
            const iconWidth = 32
            const iconWithTextWidth = activateActionElem ? activateActionElem.clientWidth : 105
            const iconGap = 5
            let count = Math.floor(
                (headerWidth -
                    paddingWidth -
                    logoWidth -
                    languagesSelectorWidth -
                    10 -
                    iconWithTextWidth * (hasActivateAction ? 1 : 0)) /
                    (iconGap + iconWidth)
            )
            count = hasActivateAction ? count + 1 : count
            if (count <= 0) {
                logoWithTextElem?.hideText()
            } else {
                logoWithTextElem?.showText()
            }
            setDisplayedActionsMaxCount(Math.min(Math.max(count, 1), 7))
        }

        const timer = setTimeout(() => handleResize(), 300)

        return () => {
            clearTimeout(timer)
        }
    }, [hasActivateAction, headerWidth, languagesSelectorWidth, headerActionButtonsWidth, showLogo])

    const actions = useLiveQuery(() => actionService.list(), [refreshActionsFlag])

    useEffect(() => {
        if (!activateAction) {
            return
        }
        if (!actions) {
            return
        }
        setActivateAction(
            actions.find((action) =>
                action.id !== undefined ? action.id === activateAction.id : action.mode === activateAction.mode
            )
        )
    }, [actions, activateAction])

    const [displayedActions, setDisplayedActions] = useState<Action[]>([])

    useEffect(() => {
        if (!actions) {
            setDisplayedActions([])
            return
        }
        let displayedActions = actions.slice(0, displayedActionsMaxCount)
        if (!displayedActions.find((action) => action.id === activateAction?.id)) {
            const activatedAction = actions.find((a) => a.id === activateAction?.id)
            if (activatedAction) {
                const lastDisplayedAction = displayedActions[displayedActions.length - 1]
                if (lastDisplayedAction) {
                    displayedActions = displayedActions.slice(0, displayedActions.length - 1)
                }
                displayedActions.push(activatedAction)
            }
        }
        setDisplayedActions(displayedActions)
    }, [actions, activateAction?.id, displayedActionsMaxCount])

    const isTranslate = currentTranslateMode === 'translate'
    useEffect(() => {
        if (!isTranslate) {
            setSelectedWord('')
            return undefined
        }
        const editor = editorRef.current
        if (!editor) {
            return undefined
        }
        const onCompositionStart = () => {
            isCompositing.current = true
        }
        const onCompositionEnd = () => {
            isCompositing.current = false
        }
        const onMouseUp = () => {
            if (editor.selectionStart === 0 && editor.selectionEnd === editor.value.length) {
                setSelectedWord('')
                return
            }
            const selectedWord_ = editor.value.substring(editor.selectionStart, editor.selectionEnd).trim()
            setSelectedWord(selectedWord_)
            if (selectedWord_) {
                setHighlightWords([])
            }
        }
        const onBlur = onMouseUp

        editor.addEventListener('compositionstart', onCompositionStart)
        editor.addEventListener('compositionend', onCompositionEnd)
        editor.addEventListener('mouseup', onMouseUp)
        editor.addEventListener('blur', onBlur)

        return () => {
            editor.removeEventListener('compositionstart', onCompositionStart)
            editor.removeEventListener('compositionend', onCompositionEnd)
            editor.removeEventListener('mouseup', onMouseUp)
            editor.removeEventListener('blur', onBlur)
        }
    }, [isTranslate])

    const { theme, themeType } = useTheme()

    const styles = useStyles({ theme, themeType, isDesktopApp: isDesktopApp(), showLogo })
    const [isLoading, setIsLoading] = useState(false)
    const [editableText, setEditableText] = useState('')
    const [translatedText, setTranslatedText] = useState('')
    const [translatedLines, setTranslatedLines] = useState<string[]>([])
    const [translateDeps, setTranslateDeps] = useState<{
        sourceLang?: LangCode
        targetLang?: LangCode
        text: string
        action?: Action
        provider?: Provider
        engineModel?: string
    }>({
        sourceLang: undefined,
        targetLang: undefined,
        text: '',
        action: undefined,
        provider: undefined,
        engineModel: undefined,
    })

    const getTranslateDeps = useCallback(
        async function (text: string, action: Action): Promise<typeof translateDeps> {
            const newSourceLang = await detectLang(text)
            setSourceLang(newSourceLang)
            return await new Promise((resolve) => {
                const isTranslate = action.mode === 'translate'
                setTargetLang((targetLang_) => {
                    const newTargetLang = (() => {
                        if (
                            isTranslate &&
                            (!stopAutomaticallyChangeTargetLang.current || newSourceLang === targetLang_)
                        ) {
                            return (
                                (newSourceLang === 'zh-Hans' || newSourceLang === 'zh-Hant'
                                    ? 'en'
                                    : (settings?.defaultTargetLanguage as LangCode | undefined)) ?? 'en'
                            )
                        }
                        if (!targetLang_) {
                            if (settings?.defaultTargetLanguage) {
                                return settings.defaultTargetLanguage as LangCode
                            }
                            return newSourceLang
                        }
                        return targetLang_
                    })()
                    setTranslateDeps((oldV) => {
                        const newV: typeof translateDeps = {
                            ...oldV,
                            sourceLang: newSourceLang,
                            targetLang: newTargetLang,
                            text,
                        }
                        resolve(newV)
                        return oldV
                    })
                    return newTargetLang
                })
            })
        },
        [settings.defaultTargetLanguage]
    )

    const { externalOriginalText } = useTranslatorStore()

    useEffect(() => {
        if (externalOriginalText === undefined) {
            return
        }
        setActivateAction((action) => {
            if (!action) {
                setTranslateDeps((v) => {
                    return {
                        ...v,
                        text: externalOriginalText,
                    }
                })
                return action
            }
            setEditableText(externalOriginalText)
            getTranslateDeps(externalOriginalText, action).then((v) => {
                setTranslateDeps(v)
            })
            return action
        })
        setSelectedWord('')
        setHighlightWords([])
    }, [externalOriginalText, getTranslateDeps, props.uuid])

    useEffect(() => {
        setEditableText(translateDeps.text)
    }, [translateDeps.text])

    useEffect(() => {
        if (translatedText) {
            setTranslatedLines(translatedText.split('\n'))
        } else {
            setTranslatedLines([])
        }
    }, [translatedText])
    const [errorMessage, setErrorMessage] = useState('')
    const startLoading = useCallback(() => {
        setIsLoading(true)
    }, [])
    const stopLoading = useCallback(() => {
        setIsLoading(false)
    }, [])
    const [sourceLang, setSourceLang] = useState<LangCode>('en')
    const [targetLang, setTargetLang] = useState<LangCode>()
    const stopAutomaticallyChangeTargetLang = useRef(false)

    useEffect(() => {
        if (!activateAction) {
            return
        }

        getTranslateDeps(editorRef.current?.value ?? '', activateAction).then((newTranslateDeps) => {
            setTranslateDeps({
                ...newTranslateDeps,
                action: activateAction,
            })
        })
    }, [activateAction, getTranslateDeps])

    const [actionStr, setActionStr] = useState('')

    useEffect(() => {
        const editor = editorRef.current
        if (!editor) return
        editor.dir = getLangConfig(sourceLang).direction
    }, [sourceLang, actionStr])

    useEffect(() => {
        setTranslatedText('')
        setIsLoading(true)
        setErrorMessage('')
    }, [])

    const translatedLanguageDirection = useMemo(() => getLangConfig(sourceLang).direction, [sourceLang])

    useEffect(() => {
        const popupCardInnerContainer: HTMLDivElement | null | undefined = document
            .querySelector(`#${containerID}`)
            ?.shadowRoot?.querySelector(`#${popupCardInnerContainerId}`)

        if (!popupCardInnerContainer) {
            return
        }

        const calculateTranslatedContentMaxHeight = (): number => {
            const { innerHeight } = window
            const maxHeight = popupCardInnerContainer ? parseInt(popupCardInnerContainer.style.maxHeight) : innerHeight

            const editorHeight = editorContainerRef.current?.offsetHeight || 0
            const actionButtonsHeight = actionButtonsRef.current?.offsetHeight || 0
            const headerHeight = headerRef.current?.offsetHeight || 0
            const { paddingTop, paddingBottom } = getComputedStyle(translatedContainerRef.current as HTMLDivElement)
            const { paddingTop: containerPaddingTop, paddingBottom: containerPaddingBottom } = getComputedStyle(
                containerRef.current as HTMLDivElement
            )
            const paddingVertical =
                parseInt(paddingTop) +
                parseInt(paddingBottom) +
                parseInt(containerPaddingTop) +
                parseInt(containerPaddingBottom)

            return maxHeight - headerHeight - editorHeight - actionButtonsHeight - paddingVertical - 15
        }

        const resizeHandle: ResizeObserverCallback = _.debounce(() => {
            // Listen for element height changes
            const $translatedContent = translatedContentRef.current
            if ($translatedContent) {
                const translatedContentMaxHeight = calculateTranslatedContentMaxHeight()
                $translatedContent.style.maxHeight = `${translatedContentMaxHeight}px`
            }
        }, 500)

        const observer = new ResizeObserver(resizeHandle)
        observer.observe(popupCardInnerContainer)
        return () => {
            observer.disconnect()
        }
    }, [showSettings])

    const translateText = useDeepCompareCallback(
        async (selectedWord: string, signal: AbortSignal) => {
            const { text, sourceLang, targetLang, action } = translateDeps
            if (!text || !sourceLang || !targetLang || !action) {
                return
            }
            const actionMode = action.mode
            const actionStrItem = actionMode
                ? actionStrItems[actionMode]
                : {
                      beforeStr: 'Processing...',
                      afterStr: 'Processed',
                  }
            const beforeTranslate = () => {
                let actionStr = actionStrItem.beforeStr
                if (actionMode === 'translate' && sourceLang === targetLang) {
                    actionStr = 'Polishing...'
                }
                setActionStr(actionStr)
                setTranslatedText('')
                setErrorMessage('')
                startLoading()
            }
            const afterTranslate = (reason: string) => {
                stopLoading()
                if (reason !== 'stop' && reason !== 'eos' && reason !== 'end_turn') {
                    if (reason === 'length' || reason === 'max_tokens') {
                        toast(t('Chars Limited'), {
                            duration: 5000,
                            icon: '😥',
                        })
                    } else {
                        setActionStr((actionStr_) => {
                            let errMsg = `${actionStr_} failed, finish_reason: ${reason}`
                            if (reason === 'content_filter') {
                                errMsg = `很抱歉！由于您使用的 LLM 有敏感词限制，很不幸这个请求已经触发了敏感词，请您接受这个结果。`
                            }
                            setErrorMessage(errMsg)
                            return 'Error'
                        })
                    }
                } else {
                    let actionStr = actionStrItem.afterStr
                    if (actionMode === 'translate' && sourceLang === targetLang) {
                        actionStr = 'Polished'
                    }
                    setActionStr(actionStr)
                }
            }
            beforeTranslate()
            const cachedKey = `translate:${translateDeps.provider ?? ''}:${translateDeps.engineModel ?? ''}:${
                action.id
            }:${action.rolePrompt}:${action.commandPrompt}:${
                action.outputRenderingFormat
            }:${sourceLang}:${targetLang}:${text}:${selectedWord}:${translationFlag}`
            const cachedValue = cache.get(cachedKey)
            if (cachedValue) {
                afterTranslate('stop')
                setTranslatedText(cachedValue as string)
                return
            }
            // let isStopped = false
            try {
                await translate({
                    action,
                    signal,
                    text,
                    selectedWord,
                    detectFrom: sourceLang,
                    detectTo: targetLang,
                    onStatusCode: (statusCode) => {
                        if (statusCode === 401 || statusCode === 403) {
                            console.log(statusCode)
                        }
                    },
                    onMessage: async (message) => {
                        if (!message.content) {
                            return
                        }
                        setTranslatedText((translatedText) => {
                            if (message.isFullText) {
                                return message.content
                            }
                            return translatedText + message.content
                        })
                    },
                    onFinish: (reason) => {
                        afterTranslate(reason)
                        setTranslatedText((translatedText) => {
                            const result = translatedText
                            cache.set(cachedKey, result)
                            return result
                        })
                    },
                    onError: (error) => {
                        if (error === 'Unauthorized') {
                            props.onAuthError && props.onAuthError()
                        }

                        setActionStr('Error')
                        setErrorMessage(error)
                        stopLoading()
                    },
                })
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
            } catch (error: any) {
                // if error is a AbortError then ignore this error
                if (error.name === 'AbortError') {
                    // isStopped = true
                    return
                }
                setActionStr('Error')
                setErrorMessage((error as Error).toString())
                stopLoading()
            } finally {
                // if (!isStopped) {
                //     console.log('finally stop')
                //     stopLoading()
                //     isStopped = true
                // }
            }
        },
        [translateDeps, translationFlag, startLoading, stopLoading, t]
    )

    const translateControllerRef = useRef<AbortController | null>(null)
    useEffect(() => {
        translateControllerRef.current = new AbortController()
        const { signal } = translateControllerRef.current
        translateText(selectedWord, signal)
        return () => {
            translateControllerRef.current?.abort()
        }
    }, [translateText, selectedWord])

    useEffect(() => {
        if (!props.defaultShowSettings) {
            return
        }
        if (!settings) {
            return
        }
        if (settings.provider === 'OpenAI' && !settings.apiKeys) {
            setShowSettings(false)
            return
        }
        if (settings.provider === 'Azure' && !settings.azureAPIKeys) {
            setShowSettings(true)
            return
        }
        if (settings.provider === 'ChatGPT' && !settings.chatgptModel) {
            setShowSettings(true)
            return
        }
        if (settings.provider === 'MiniMax' && !settings.miniMaxAPIKey) {
            setShowSettings(true)
            return
        }
        if (settings.provider === 'Moonshot' && !settings.moonshotAPIKey) {
            setShowSettings(true)
            return
        }
        if (settings.provider === 'Groq' && !settings.groqAPIKey) {
            setShowSettings(true)
            return
        }
    }, [props.defaultShowSettings, setShowSettings, settings])

    const editableTextSpeakingIconRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        if (selectedWord === '' || settings?.readSelectedWordsFromInputElementsText === false) {
            return
        }
        console.debug('speak selected word', selectedWord)
        editableTextSpeakingIconRef.current?.click()
    }, [selectedWord, settings.readSelectedWordsFromInputElementsText])

    const handleStopGenerating = () => {
        console.log('stop gene')
        translateControllerRef.current?.abort('stop')
        stopLoading()
        setActionStr('Stopped')
    }

    const [isScrolledToTop, setIsScrolledToTop] = useState(false)

    useEffect(() => {
        const isOnTop = () => {
            return document.documentElement.scrollTop === 0
        }

        setIsScrolledToTop(isOnTop())

        const onScroll = () => {
            setIsScrolledToTop(isOnTop())
        }

        window.addEventListener('scroll', onScroll)
        window.addEventListener('resize', onScroll)
        const observer = new MutationObserver(onScroll)
        observer.observe(document.body, {
            childList: true,
            subtree: true,
        })
        return () => {
            window.removeEventListener('scroll', onScroll)
            window.removeEventListener('resize', onScroll)
            observer.disconnect()
        }
    }, [showSettings])

    const showSubmitButton = () => {
        if (activateAction?.id === undefined) {
            return false
        }

        if (translateDeps.action?.id === undefined) {
            return false
        }

        if (!editableText) {
            return false
        }

        if (editableText !== translateDeps.text) {
            return true
        }

        return false
    }

    const handleSubmit = useCallback(
        (e: React.SyntheticEvent<HTMLButtonElement> | React.KeyboardEvent<HTMLTextAreaElement>) => {
            e.preventDefault()
            e.stopPropagation()
            let action = activateAction
            if (!action) {
                action = actions?.find((action) => action.mode === 'translate')
                setActivateAction(action)
            }
            const text = editorRef.current?.value ?? ''
            if (action) {
                getTranslateDeps(text, action).then((v) => {
                    setTranslateDeps(v)
                })
            }
        },
        [actions, activateAction, getTranslateDeps]
    )

    return (
        <div
            className={clsx(styles.popupCard, {
                'gptedit-dark': themeType === 'dark',
            })}
            ref={containerRef}
            style={{
                minHeight: vocabularyType !== 'hide' ? '600px' : undefined,
                background: theme.colors.backgroundPrimary,
            }}
        >
            {showSettings && (
                <InnerSettings
                    onSave={(oldSettings) => {
                        props.onSettingsSave?.(oldSettings)
                    }}
                />
            )}
            <div
                style={{
                    display: !showSettings ? 'block' : 'none',
                }}
            >
                <div style={props.containerStyle}>
                    <div
                        ref={headerRef}
                        className={styles.popupCardHeaderContainer}
                        data-tauri-drag-region
                        style={{
                            cursor: isDesktopApp() ? 'default' : showLogo ? 'move' : 'default',
                            boxShadow: isDesktopApp() && !isScrolledToTop ? theme.lighting.shadow600 : undefined,
                            background: settings.enableBackgroundBlur ? 'transparent' : '',
                        }}
                    >
                        {/* {showLogo && <LogoWithText ref={logoWithTextRef} />} */}
                        <div className={styles.popupCardHeaderActionsContainer} ref={languagesSelectorRef}>
                            <div className={styles.from}>
                                <Select
                                    disabled={currentTranslateMode === 'explain-code'}
                                    size='mini'
                                    clearable={false}
                                    options={sourceLangOptions}
                                    value={[{ id: sourceLang }]}
                                    overrides={{
                                        Root: {
                                            style: {
                                                minWidth: '110px',
                                            },
                                        },
                                    }}
                                    onChange={({ value }) => {
                                        const langId = value.length > 0 ? value[0].id : sourceLangOptions[0].id
                                        setSourceLang(langId as LangCode)
                                        setTranslateDeps((v) => {
                                            return {
                                                ...v,
                                                text: editableText,
                                                sourceLang: langId as LangCode,
                                            }
                                        })
                                    }}
                                />
                            </div>
                            <div
                                className={styles.arrow}
                                onClick={() => {
                                    setTranslateDeps((v) => ({
                                        ...v,
                                        text: translatedText,
                                        sourceLang: targetLang ?? 'en',
                                        targetLang: sourceLang,
                                    }))
                                    setSourceLang(targetLang ?? 'en')
                                    setTargetLang(sourceLang)
                                    editorRef.current?.focus()
                                }}
                            >
                                <Tooltip content='Exchange' placement='top'>
                                    <div>
                                        <TbArrowsExchange />
                                    </div>
                                </Tooltip>
                            </div>
                            <div className={styles.to}>
                                <Select
                                    disabled={currentTranslateMode === 'polishing'}
                                    size='mini'
                                    clearable={false}
                                    options={targetLangOptions}
                                    value={[{ id: targetLang }]}
                                    overrides={{
                                        Root: {
                                            style: {
                                                minWidth: '110px',
                                            },
                                        },
                                    }}
                                    onChange={({ value }) => {
                                        stopAutomaticallyChangeTargetLang.current = true
                                        const langId = value.length > 0 ? value[0].id : targetLangOptions[0].id
                                        setTargetLang(langId as LangCode)
                                        setTranslateDeps((v) => {
                                            return {
                                                ...v,
                                                text: editableText,
                                                targetLang: langId as LangCode,
                                            }
                                        })
                                    }}
                                />
                            </div>
                        </div>
                        <div className={styles.popupCardHeaderButtonGroup} ref={headerActionButtonsRef}>
                            {displayedActions?.map((action) => {
                                return (
                                    <Tooltip
                                        key={action.id}
                                        content={action.mode ? t(action.name) : action.name}
                                        placement={isDesktopApp() ? 'bottom' : 'top'}
                                    >
                                        <Button
                                            size='mini'
                                            kind={action.id === activateAction?.id ? 'primary' : 'secondary'}
                                            className={
                                                action.id === activateAction?.id
                                                    ? '__gptedit-activate-action'
                                                    : undefined
                                            }
                                            overrides={{
                                                Root: {
                                                    style: {
                                                        height: '27px',
                                                        display: 'flex',
                                                        flexDirection: 'row',
                                                        alignItems: 'center',
                                                        gap: '4px',
                                                    },
                                                },
                                            }}
                                            onClick={() => {
                                                setActivateAction(action)
                                                if (action.mode === 'polishing') {
                                                    setTargetLang(sourceLang)
                                                }
                                            }}
                                        >
                                            {action.icon &&
                                                React.createElement(mdIcons[action.icon as keyof typeof mdIcons], {
                                                    size: 15,
                                                })}
                                            {action.id === activateAction?.id && (
                                                <div
                                                    style={{
                                                        maxWidth: 100,
                                                        whiteSpace: 'nowrap',
                                                        overflow: 'hidden',
                                                        textOverflow: 'ellipsis',
                                                    }}
                                                >
                                                    {action.mode ? t(action.name) : action.name}
                                                </div>
                                            )}
                                        </Button>
                                    </Tooltip>
                                )
                            })}
                        </div>
                    </div>
                    <div className={styles.popupCardContentContainer}>
                        <div ref={editorContainerRef} className={styles.popupCardEditorContainer}>
                            <div
                                style={{
                                    height: 0,
                                    overflow: 'hidden',
                                }}
                            >
                                {editableText}
                            </div>
                            <Textarea
                                inputRef={editorRef}
                                autoFocus={autoFocus}
                                overrides={{
                                    Root: {
                                        style: {
                                            fontSize: '15px !important',
                                            width: '100%',
                                            borderRadius: '0px',
                                        },
                                    },
                                    Input: {
                                        style: {
                                            fontSize: '15px !important',
                                            padding: '4px 8px',
                                            color:
                                                themeType === 'dark'
                                                    ? theme.colors.contentSecondary
                                                    : theme.colors.contentPrimary,
                                            fontFamily:
                                                currentTranslateMode === 'explain-code' ? 'monospace' : 'inherit',
                                            textalign: 'start',
                                        },
                                    },
                                }}
                                value={editableText}
                                size='mini'
                                resize='vertical'
                                rows={
                                    props.editorRows
                                        ? props.editorRows
                                        : Math.min(Math.max(editableText.split('\n').length, 3), 12)
                                }
                                onChange={(e) => setEditableText(e.target.value)}
                                onKeyDown={(e) => {
                                    e.stopPropagation()
                                }}
                                onKeyUp={(e) => {
                                    e.stopPropagation()
                                }}
                                onKeyPress={(e) => {
                                    e.stopPropagation()
                                    if (e.key === 'Enter' && !e.shiftKey) {
                                        handleSubmit(e)
                                    }
                                }}
                            />
                            <div
                                style={{
                                    display: 'flex',
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    paddingTop: showSubmitButton() ? 8 : 0,
                                    height: showSubmitButton() ? 28 : 0,
                                    transition: 'all 0.3s linear',
                                    overflow: 'hidden',
                                }}
                            >
                                <div className={styles.flexPlaceHolder} />
                                <div
                                    style={{
                                        display: 'flex',
                                        flexDirection: 'row',
                                        alignItems: 'center',
                                        gap: 10,
                                    }}
                                >
                                    <div className={styles.enterHint}>
                                        {'Press <Enter> to submit, <Shift+Enter> for a new line.'}
                                    </div>
                                    <Button
                                        size='mini'
                                        onClick={handleSubmit}
                                        startEnhancer={<IoIosRocket size={13} />}
                                        overrides={{
                                            StartEnhancer: {
                                                style: {
                                                    marginRight: '6px',
                                                },
                                            },
                                            BaseButton: {
                                                style: {
                                                    fontWeight: 'normal',
                                                    fontSize: '12px',
                                                    padding: '4px 8px',
                                                },
                                            },
                                        }}
                                    >
                                        {t('Submit')}
                                    </Button>
                                </div>
                            </div>
                            <div className={styles.actionButtonsContainer}>
                                <div style={{ marginLeft: 'auto' }}></div>
                                {!!editableText.length && (
                                    <>
                                        {isLoading && (
                                            <Tooltip content={t('Stop')} placement='bottom'>
                                                <div className={styles.actionButton} onClick={handleStopGenerating}>
                                                    <RxStop size={15} />
                                                </div>
                                            </Tooltip>
                                        )}
                                        <Tooltip content={t('Speak')} placement='bottom'>
                                            <div className={styles.actionButton}>
                                                <SpeakerIcon
                                                    size={15}
                                                    divRef={editableTextSpeakingIconRef}
                                                    provider={settings.tts?.provider}
                                                    text={selectedWord ? selectedWord : editableText}
                                                    lang={sourceLang}
                                                    voice={
                                                        settings.tts?.voices?.find((item) => item.lang === sourceLang)
                                                            ?.voice
                                                    }
                                                    rate={settings.tts?.rate}
                                                    volume={settings.tts?.volume}
                                                />
                                            </div>
                                        </Tooltip>
                                        <Tooltip content={t('Copy to clipboard')} placement='bottom'>
                                            <div className={styles.actionButton}>
                                                <CopyButton text={editableText} styles={styles}></CopyButton>
                                            </div>
                                        </Tooltip>
                                        <Tooltip content={t('Clear input')} placement='bottom'>
                                            <div
                                                className={styles.actionButton}
                                                onClick={() => {
                                                    setEditableText('')
                                                    setTranslatedText('')
                                                    setTranslateDeps((v) => {
                                                        return {
                                                            ...v,
                                                            text: '',
                                                        }
                                                    })
                                                    editorRef.current?.focus()
                                                }}
                                            >
                                                <div className={styles.actionButton}>
                                                    <RxEraser size={15} />
                                                </div>
                                            </div>
                                        </Tooltip>
                                    </>
                                )}
                            </div>
                        </div>
                        <div
                            className={styles.popupCardTranslatedContainer}
                            ref={translatedContainerRef}
                            dir={translatedLanguageDirection}
                        >
                            {actionStr && (
                                <div
                                    className={clsx({
                                        [styles.actionStr]: true,
                                        [styles.error]: !!errorMessage,
                                    })}
                                >
                                    <div>{actionStr}</div>
                                    {isLoading ? (
                                        <span className={styles.writing} key={'1'} />
                                    ) : errorMessage ? (
                                        <span key={'2'}>😢</span>
                                    ) : translateControllerRef.current?.signal.aborted &&
                                      translateControllerRef.current?.signal.reason === 'stop' ? (
                                        <span key={'3'}>⏹️</span>
                                    ) : (
                                        <span key={'4'}>👍</span>
                                    )}
                                </div>
                            )}
                            {errorMessage ? (
                                <div className={styles.errorMessage}>
                                    <span>{errorMessage}</span>
                                    <Tooltip content={t('Retry')} placement='top'>
                                        <div onClick={() => forceTranslate()} className={styles.actionButton}>
                                            <RxReload size={15} />
                                        </div>
                                    </Tooltip>
                                </div>
                            ) : (
                                <div
                                    style={{
                                        width: '100%',
                                    }}
                                >
                                    <div
                                        ref={translatedContentRef}
                                        className={styles.popupCardTranslatedContentContainer}
                                    >
                                        <div style={{ minHeight: 60 }}>
                                            {translatedLines.length === 0 && isLoading && (
                                                <div className={styles.paragraph}>
                                                    <span className={styles.caret} />
                                                </div>
                                            )}
                                            {currentTranslateMode === 'explain-code' ||
                                            activateAction?.outputRenderingFormat === 'markdown' ? (
                                                <>
                                                    <Markdown>{translatedText}</Markdown>
                                                    {isLoading && <span className={styles.caret} />}
                                                </>
                                            ) : activateAction?.outputRenderingFormat === 'latex' ? (
                                                <>
                                                    <Latex>{translatedText}</Latex>
                                                    {isLoading && <span className={styles.caret} />}
                                                </>
                                            ) : (
                                                translatedLines.map((line, i) => {
                                                    return (
                                                        <div className={styles.paragraph} key={`p-${i}`}>
                                                            {line}
                                                            {isLoading && i === translatedLines.length - 1 && (
                                                                <span className={styles.caret} />
                                                            )}
                                                        </div>
                                                    )
                                                })
                                            )}
                                        </div>
                                    </div>
                                    {translatedText && (
                                        <div ref={actionButtonsRef} className={styles.actionButtonsContainer}>
                                            <div style={{ marginRight: 'auto' }} />
                                            {!isLoading && (
                                                <Tooltip content={t('Retry')} placement='top'>
                                                    <div
                                                        onClick={() => forceTranslate()}
                                                        className={styles.actionButton}
                                                    >
                                                        <RxReload size={15} />
                                                    </div>
                                                </Tooltip>
                                            )}
                                            <Tooltip content={t('Speak')} placement='top'>
                                                <div className={styles.actionButton}>
                                                    <SpeakerIcon
                                                        size={15}
                                                        provider={settings.tts?.provider}
                                                        text={translatedText}
                                                        lang={targetLang ?? 'en'}
                                                        voice={
                                                            settings.tts?.voices?.find(
                                                                (item) => item.lang === targetLang
                                                            )?.voice
                                                        }
                                                        rate={settings.tts?.rate}
                                                        volume={settings.tts?.volume}
                                                    />
                                                </div>
                                            </Tooltip>
                                            <Tooltip content={t('Copy to clipboard')} placement='top'>
                                                <div className={styles.actionButton}>
                                                    <CopyButton text={translatedText} styles={styles}></CopyButton>
                                                </div>
                                            </Tooltip>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
            <Toaster />
        </div>
    )
}
