#!/data/data/com.termux/files/usr/bin/bash
railway variables 2>/dev/null | grep "DISCORD_TOKEN" | awk -F'│' '{print $3}' | tr -d ' '
