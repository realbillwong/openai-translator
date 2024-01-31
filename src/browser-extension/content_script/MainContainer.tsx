import '../enable-dev-hmr'
import * as utils from '../../common/utils'
import { useEffect, useState } from 'react'
import { Client as Styletron } from 'styletron-engine-atomic'
import { Translator } from '../../common/components/Translator'
import { LoginForm } from '../../common/components/LoginForm'
import '../../common/i18n.js'
import TitleBar from './TitleBar'
import { IUserInfo } from '../../common/types'
import { useSettings } from '../../common/hooks/useSettings'

interface IMainContainerProps {
    engine: Styletron
    autoFocus: boolean
    isUserscript: boolean
    onClose: () => void
}

export default function MainContainer(props: IMainContainerProps) {
    const [userinfo, setUserInfo] = useState<IUserInfo | undefined>()
    const { settings } = useSettings()
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        // get userinfo
        utils.getUserInfo().then((info) => {
            setUserInfo(info)
            setLoading(false)
        })
    }, [])

    const handleLoginSucceed = (info: IUserInfo) => {
        setUserInfo(info)
    }

    const handleAuthError = () => {
        utils.removeUserInfo().then(() => {
            setUserInfo(undefined)
        })
    }

    const renderContent = () => {
        if (loading) return null

        if (userinfo?.email) {
            return (
                <Translator
                    engine={props.engine}
                    autoFocus={props.autoFocus}
                    showSettings={false}
                    showSettingsIcon={false}
                    defaultShowSettings={props.isUserscript}
                    showLogo={false}
                    onAuthError={handleAuthError}
                />
            )
        }

        return <LoginForm engine={props.engine} onLogin={handleLoginSucceed} />
    }

    return (
        <>
            <TitleBar userinfo={userinfo} pinned={settings.pinned} onClose={props.onClose} engine={props.engine} />
            {renderContent()}
        </>
    )
}
