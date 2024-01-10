export interface ILogin {
    email: string
    password: string
}

export interface IUserInfo {
    email: string
    username: string
    verified: 0 | 1
    expire_at: string
}

export interface IToken {
    accessToken: string
    refreshToken: string
}

export interface IGptEditService {
    login(opt: ILogin): Promise<IToken>
    getUser(token: string): Promise<IUserInfo>
    refreshToken(token: string): Promise<IToken>
}

class GptEditService implements IGptEditService {
    login(opt: ILogin): Promise<IToken> {
        return fetch('https://gptedit.ai233.com/api/auth/signin', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(opt),
        })
            .then((resp) => resp.json())
            .then((resp) => {
                if (resp.success) {
                    return resp.data
                }
                throw new Error(resp.message)
            })
    }

    getUser(token: string): Promise<IUserInfo> {
        return fetch('https://gptedit.ai233.com/api/auth/user', {
            headers: {
                Authorization: `Bearer ${token}`,
            },
        })
            .then((resp) => resp.json())
            .then((resp) => {
                if (resp.success) {
                    return resp.data
                }
                throw new Error(resp.message)
            })
    }

    refreshToken(token: string): Promise<IToken> {
        return fetch('https://gptedit.ai233.com/api/auth/refresh', {
            headers: {
                Authorization: `Bearer ${token}`,
            },
        })
            .then((resp) => resp.json())
            .then((resp) => {
                if (resp.success) {
                    return resp.data
                }
                throw new Error(resp.message)
            })
    }
}

export const gptEditService = new GptEditService()
