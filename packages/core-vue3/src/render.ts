import { resolve } from 'path'
import { loadConfig, getCwd, StringToStream, mergeStream2 } from 'ssr-server-utils'
import { renderToNodeStream, renderToString } from '@vue/server-renderer'
import { ISSRContext, UserConfig, ExpressContext } from 'ssr-types'

const cwd = getCwd()
const defaultConfig = loadConfig()

function render (ctx: ISSRContext, options?: UserConfig): Promise<string>
function render<T> (ctx: ISSRContext, options?: UserConfig): Promise<T>

async function render (ctx: ISSRContext, options?: UserConfig) {
  const isVite = process.env.BUILD_TOOL === 'vite'
  if (isVite) {
    return await viteRender(ctx, options)
  } else {
    return await commonRender(ctx, options)
  }
}

async function viteRender (ctx: ISSRContext, options?: UserConfig) {
  const config = Object.assign({}, defaultConfig, options ?? {})
  const { stream } = config

  if (!ctx.response.type && typeof ctx.response.type !== 'function') {
    // midway/koa 场景设置默认 content-type
    ctx.response.type = 'text/html;charset=utf-8'
  } else if (!(ctx as ExpressContext).response.hasHeader?.('content-type')) {
    // express 场景
    (ctx as ExpressContext).response.setHeader?.('Content-type', 'text/html;charset=utf-8')
  }
  const { serverRender } = await global.vite.ssrLoadModule(resolve(cwd, './node_modules/ssr-plugin-vue3/esm/entry/server-entry.js'))
  const serverRes = await serverRender(ctx, config)

  if (stream) {
    const stream = mergeStream2(new StringToStream('<!DOCTYPE html>'), renderToNodeStream(serverRes))
    stream.on('error', (e: any) => {
      console.log(e)
    })
    return stream
  } else {
    return `<!DOCTYPE html>${await renderToString(serverRes)}`
  }
}
async function commonRender (ctx: ISSRContext, options?: UserConfig) {
  const config = Object.assign({}, defaultConfig, options ?? {})
  const { isDev, chunkName, stream } = config
  const isLocal = isDev || process.env.NODE_ENV !== 'production'
  const serverFile = resolve(cwd, `./build/server/${chunkName}.server.js`)

  if (isLocal) {
    // clear cache in development environment
    delete require.cache[serverFile]
  }
  if (!ctx.response.type && typeof ctx.response.type !== 'function') {
    // midway/koa 场景设置默认 content-type
    ctx.response.type = 'text/html;charset=utf-8'
  } else if (!(ctx as ExpressContext).response.hasHeader?.('content-type')) {
    // express 场景
    (ctx as ExpressContext).response.setHeader?.('Content-type', 'text/html;charset=utf-8')
  }
  const { serverRender } = require(serverFile)
  const serverRes = await serverRender(ctx, config)

  if (stream) {
    const stream = mergeStream2(new StringToStream('<!DOCTYPE html>'), renderToNodeStream(serverRes))
    stream.on('error', (e: any) => {
      console.log(e)
    })
    return stream
  } else {
    return `<!DOCTYPE html>${await renderToString(serverRes)}`
  }
}

export { render }
