import { useTranslation } from 'react-i18next'
import { createUseStyles } from 'react-jss'
import browser from 'webextension-polyfill'
import { createForm } from './Form'
import { useTheme } from '../hooks/useTheme'
import { useSettings } from '../hooks/useSettings'
import { Input as BaseInput } from 'baseui-sd/input'
import { Client as Styletron } from 'styletron-engine-atomic'
import { Provider as StyletronProvider } from 'styletron-react'
import { BaseProvider } from 'baseui-sd'
import { Button as BaseButton } from 'baseui-sd/button'
import { useCallback, useState, useEffect } from 'react'
import { gptEditService, ILogin } from '../internal-services/gptedit'
import { IThemedStyleProps, IUserInfo } from '../types'

const { Form, FormItem } = createForm<ILogin>()

const useStyles = createUseStyles({
    login: (props: IThemedStyleProps) => ({
        padding: '50px 100px',
        background: props.themeType === 'dark' ? 'rgba(31, 31, 31, 1)' : 'rgba(255, 255, 255, 1)',
    }),
})

export interface ILoginFormProps {
    engine: Styletron
    onLogin: (info: IUserInfo) => void
}

export function LoginForm({ engine, onLogin }: ILoginFormProps) {
    const { theme, themeType } = useTheme()
    const styles = useStyles({ theme, themeType })
    const { t, i18n } = useTranslation()
    const { settings } = useSettings()

    const [loading, setLoading] = useState(false)

    const onSubmit = async (values: ILogin) => {
        try {
            setLoading(true)
            const tokens = await gptEditService.login(values)
            const userInfo = await gptEditService.getUser(tokens.accessToken)

            browser.storage.local.set({
                tokens,
                userInfo,
            })

            onLogin({
                ...tokens,
                ...userInfo,
            })

            setLoading(false)
        } catch (e) {
            setLoading(false)
            console.error(e)
        }
    }

    const [values, setValues] = useState<ILogin | undefined>()

    const handleValuesChange = useCallback((_changes: Partial<ILogin>, values: ILogin) => {
        setValues(values)
    }, [])

    useEffect(() => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if (settings?.i18n !== (i18n as any).language) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            ;(i18n as any).changeLanguage(settings?.i18n)
        }
    }, [i18n, settings.i18n])

    return (
        <div className={styles.login}>
            <StyletronProvider value={engine}>
                <BaseProvider theme={theme}>
                    <Form initialValues={values} onValuesChange={handleValuesChange} onFinish={onSubmit}>
                        <FormItem required name='email' label={t('Email')}>
                            <BaseInput size='compact' />
                        </FormItem>
                        <FormItem required name='password' label={t('Password')}>
                            <BaseInput size='compact' type='password' />
                        </FormItem>
                        <BaseButton isLoading={loading} size='compact'>
                            {t('Submit')}
                        </BaseButton>
                    </Form>
                </BaseProvider>
            </StyletronProvider>
        </div>
    )
}
