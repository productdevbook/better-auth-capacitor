package io.betterauth.capacitor

import android.content.Intent
import android.net.Uri
import androidx.browser.customtabs.CustomTabsIntent
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin

@CapacitorPlugin(name = "BetterAuthCapacitor")
class BetterAuthCapacitorPlugin : Plugin() {

    private var savedCallbackId: String? = null
    private var redirectScheme: String? = null

    @PluginMethod
    fun openAuthSession(call: PluginCall) {
        val url = call.getString("url")
        val scheme = call.getString("redirectScheme")

        if (url == null || scheme == null) {
            call.reject("Missing url or redirectScheme")
            return
        }

        redirectScheme = scheme
        bridge.saveCall(call)
        savedCallbackId = call.callbackId

        val customTabsIntent = CustomTabsIntent.Builder().build()
        customTabsIntent.launchUrl(activity, Uri.parse(url))
    }

    override fun handleOnNewIntent(intent: Intent) {
        super.handleOnNewIntent(intent)

        val data = intent.data ?: return
        val scheme = redirectScheme ?: return
        val callbackId = savedCallbackId ?: return

        // Only handle intents matching our redirect scheme
        if (data.scheme != scheme) return

        val savedCall = bridge.getSavedCall(callbackId) ?: return

        val ret = JSObject()
        ret.put("url", data.toString())
        savedCall.resolve(ret)

        bridge.releaseCall(callbackId)
        savedCallbackId = null
        redirectScheme = null
    }
}
