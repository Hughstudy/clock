import { useEffect, useRef, useState } from 'react'
import { createChime } from '../adapters/sound'

/** A preview is an explicit gesture, independent of saved sound preferences or timer events. */
export function useSoundPreview() {
  const [chime] = useState(createChime)
  const [playing, setPlaying] = useState(false)
  const [message, setMessage] = useState('')
  const mounted = useRef(false)
  const busy = useRef(false)
  const cooldown = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false; clearTimeout(cooldown.current) }
  }, [])
  const preview = async () => {
    if (busy.current) return
    busy.current = true
    setPlaying(true)
    const result = await chime.preview()
    if (!mounted.current) return
    setMessage(result === 'played' ? '已播放试听提示音。' : result === 'unavailable'
      ? '此浏览器暂不支持提示音，计时照常可用。' : '提示音未能播放，可以再试一次；计时照常可用。')
    cooldown.current = setTimeout(() => { busy.current = false; if (mounted.current) setPlaying(false) }, result === 'played' ? 1100 : 0)
  }
  return { playing, message, preview }
}
