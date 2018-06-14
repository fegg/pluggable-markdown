import marked from 'marked'
import myMarked from './marked'
import token from './token'
import tok from './tok'

marked.Lexer.prototype.token = token

export default class Markdown {
  get output () {
    return this.output_
  }

  get error () {
    return this.error_
  }

  get context () {
    return this.context_
  }

  get tokens () {
    return this.tokens_
  }

  constructor (options = {}) {
    this.options_ = options
    this.plugins_ = {}
    this.output_ = ''
    this.error_ = null
    this.context_ = {}
    this.tokens_ = []
  }

  registerPlugin (plugin) {
    const { name } = plugin

    if (this.plugins_[name]) {
      throw new Error(`${name}插件已经被注册.`)
    }

    this.plugins_[name] = plugin
  }

  exec (src) {
    const self = this
    const backupTok = marked.Parser.prototype.tok

    marked.Parser.prototype.tok = function () {
      // this是Parser实例，self是Markdown实例
      return tok.call(this, self._handlePluginRender.bind(self))
    }

    // 这里必须清空, 否则本次执行会和上次有冲突
    this.context_ = {}

    myMarked(src, this.options_,
      this._handleTokens.bind(this, src),
      this._handleResult.bind(this))

    marked.Parser.prototype.tok = backupTok
  }

  _handleTokens (src, tokens) {
    const task = toks => {
      const index = toks.findIndex(tok => tok.type === 'plugin' && !tok.handled)

      if (index < 0) {
        return [tokens, true]
      }

      const pluginToken = toks[index]

      return [this._handlePluginToken(pluginToken, index, tokens, src), false]
    }

    let toks = tokens

    while (true) {
      const [newToks, finished] = task(toks)

      if (finished) {
        break
      }

      toks = newToks
    }

    this.tokens_ = toks.slice()

    return toks
  }

  _handlePluginRender (pluginToken) {
    const { name } = pluginToken
    const plugin = this.plugins_[name]

    if (!plugin) {
      console.warn(`render时找不到插件${name}`)
      return ''
    }

    if (!plugin.render) {
      return ''
    }

    console.log(`执行插件 ${name} render流程...`)
    return plugin.render(this.context_, pluginToken)
  }

  _handleResult (err, output) {
    this.error_ = err
    this.output_ = output
  }

  _handlePluginToken (pluginToken, pluginTokenIndex, tokens, src) {
    const { name } = pluginToken
    pluginToken.handled = true

    const plugin = this.plugins_[name]

    if (!plugin) {
      console.warn(`token时找不到插件${name}`)
      return tokens
    }

    if (!plugin.token) {
      return tokens
    }

    console.log(`执行插件 ${name} token处理流程...`)
    return plugin.token(this.context_, pluginToken, pluginTokenIndex, tokens, src)
  }
}
