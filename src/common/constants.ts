export const CUSTOM_MODEL_ID = '__custom__'
import { TranslateMode } from './translate'

export const PREFIX = '__gptedit-translator'
export const builtinActionModes: { name: string; mode: Exclude<TranslateMode, 'big-bang'>; icon: string }[] = [
    {
        name: 'Translate',
        mode: 'translate',
        icon: 'MdOutlineGTranslate',
    },
    {
        name: 'Polishing',
        mode: 'polishing',
        icon: 'MdPalette',
    },
    {
        name: 'Summarize',
        mode: 'summarize',
        icon: 'MdOutlineSummarize',
    },
    {
        name: 'Analyze',
        mode: 'analyze',
        icon: 'MdOutlineAnalytics',
    },
    {
        name: 'Explain Code',
        mode: 'explain-code',
        icon: 'MdCode',
    },
]
export const chatgptArkoseReqParams = 'cgb=vhwi'
