import { forwardRef, useImperativeHandle, useRef } from 'react'
import { createUseStyles } from 'react-jss'
import { IThemedStyleProps, IUserInfo } from '../types'
import { useTheme } from '../hooks/useTheme'
import { getAssetUrl } from '../utils'
import icon from '../assets/images/icon.png'

const useStyles = createUseStyles({
    iconContainer: {
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        flexShrink: 0,
        marginRight: 'auto',
    },
    icon: {
        'display': 'block',
        'width': '16px',
        'height': '16px',
        '-ms-user-select': 'none',
        '-webkit-user-select': 'none',
        'user-select': 'none',
        'pointerEvents': 'none',
    },
    iconText: (props: IThemedStyleProps) => ({
        color: props.themeType === 'dark' ? props.theme.colors.contentSecondary : props.theme.colors.contentPrimary,
        fontSize: '12px',
        fontWeight: 600,
        cursor: 'unset',
        userSelect: 'none',
    }),
    login: {
        color: 'red',
        fontSize: '12px',
        fontWeight: 600,
        cursor: 'pointer',
        userSelect: 'none',
        background: 'none',
        border: 'none',
    },
    userinfo: {
        color: '#999',
        fontSize: '12px',
        fontWeight: 600,
        cursor: 'unset',
        userSelect: 'none',
    },
})

export type LogoWithTextRef = {
    hideText: () => void
    showText: () => void
}

interface ILogoWithTextProps {
    userinfo?: IUserInfo
}

const LogoWithText = forwardRef<LogoWithTextRef, ILogoWithTextProps>(function LogoWithText(
    props: ILogoWithTextProps,
    ref
) {
    const { theme, themeType } = useTheme()
    const styles = useStyles({ theme, themeType })

    const logoTextRef = useRef<HTMLDivElement>(null)

    useImperativeHandle(
        ref,
        () => {
            return {
                hideText() {
                    if (logoTextRef.current) {
                        logoTextRef.current.style.display = 'none'
                    }
                },
                showText() {
                    if (logoTextRef.current) {
                        logoTextRef.current.style.display = 'flex'
                    }
                },
            }
        },
        []
    )

    return (
        <div data-tauri-drag-region className={styles.iconContainer}>
            <img data-tauri-drag-region className={styles.icon} src={getAssetUrl(icon)} />
            <div data-tauri-drag-region className={styles.iconText} ref={logoTextRef}>
                GPT Edit 翻译
            </div>
            {props.userinfo?.email ? (
                <span className={styles.userinfo}>({props.userinfo.email})</span>
            ) : (
                <span className={styles.login}>(未登录)</span>
            )}
        </div>
    )
})

export default LogoWithText
