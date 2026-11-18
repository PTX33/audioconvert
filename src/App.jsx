
import { useState, useRef, useEffect } from 'react'
import { FFmpeg } from '@ffmpeg/ffmpeg'
import { fetchFile, toBlobURL } from '@ffmpeg/util'

import './App.css'

function App() {
  const ffmpegRef = useRef(null)
  const fileInputRef = useRef(null)

  const [file, setFile] = useState(null)
  const [format, setFormat] = useState('mp3')
  const [quality, setQuality] = useState('192')
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const [progress, setProgress] = useState(0)
  const [busy, setBusy] = useState(false)
  const [resultUrl, setResultUrl] = useState('')
  const [resultName, setResultName] = useState('')
  const [dragging, setDragging] = useState(false)

  const extension = file?.name.split('.').pop()?.toLowerCase()

  const alreadySameFormat = Boolean(
    file && extension === format
  )

  useEffect(() => {
    return () => {
      if (resultUrl) URL.revokeObjectURL(resultUrl)
    }
  }, [resultUrl])

  const selectFile = (selectedFile) => {
    if (!selectedFile) return

    const validFile =
      selectedFile.type.startsWith('audio/') ||
      /\.(mp3|wav|ogg|m4a|aac|flac|wma|opus)$/i.test(selectedFile.name)

    if (!validFile) {
      setError('Please select a valid audio file.')
      return
    }

    setFile(selectedFile)
    setError('')
    setStatus('')
    setProgress(0)
    setResultUrl('')
  }

  const loadFFmpeg = async () => {
    if (!ffmpegRef.current) {
      const ffmpeg = new FFmpeg()

      ffmpeg.on('progress', ({ progress }) => {
        setProgress(Math.min(99, Math.round(progress * 100)))
      })

      ffmpeg.on('log', ({ message }) => {
        console.log('[FFmpeg]', message)
      })

      ffmpegRef.current = ffmpeg
    }

    const ffmpeg = ffmpegRef.current

    if (!ffmpeg.loaded) {
      setStatus('Loading audio engine...')

      const baseURL =
        'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/esm'

      await ffmpeg.load({
        coreURL: await toBlobURL(
          `${baseURL}/ffmpeg-core.js`,
          'text/javascript'
        ),
        wasmURL: await toBlobURL(
          `${baseURL}/ffmpeg-core.wasm`,
          'application/wasm'
        ),
      })
    }

    return ffmpeg
  }

  const convertAudio = async () => {
    if (!file || busy || alreadySameFormat) return

    setBusy(true)
    setError('')
    setStatus('Preparing your audio...')
    setProgress(0)

    if (resultUrl) {
      URL.revokeObjectURL(resultUrl)
      setResultUrl('')
    }

    const safeExtension = extension || 'audio'
    const inputName = `input.${safeExtension}`
    const outputName = `converted.${format}`

    try {
      const ffmpeg = await loadFFmpeg()

      await ffmpeg.writeFile(
        inputName,
        await fetchFile(file)
      )

      setStatus('Converting your audio...')

      let args

      if (format === 'mp3') {
        args = [
          '-i', inputName,
          '-vn',
          '-c:a', 'libmp3lame',
          '-b:a', `${quality}k`,
          outputName
        ]
      } else if (format === 'wav') {
        args = [
          '-i', inputName,
          '-vn',
          '-c:a', 'pcm_s16le',
          outputName
        ]
      } else {
        args = [
          '-i', inputName,
          '-vn',
          '-c:a', 'libvorbis',
          '-q:a', '5',
          outputName
        ]
      }

      const exitCode = await ffmpeg.exec(args)

      if (exitCode !== 0) {
        throw new Error(
          `FFmpeg could not convert this file. Error code: ${exitCode}`
        )
      }

      const data = await ffmpeg.readFile(outputName)

      const mime =
        format === 'mp3'
          ? 'audio/mpeg'
          : format === 'wav'
            ? 'audio/wav'
            : 'audio/ogg'

      const blob = new Blob([data], { type: mime })
      const url = URL.createObjectURL(blob)

      setResultUrl(url)

      setResultName(
        `${file.name.replace(/\.[^/.]+$/, '')}.${format}`
      )

      setProgress(100)
      setStatus('Conversion complete! Your file is ready.')

      await ffmpeg.deleteFile(inputName)
      await ffmpeg.deleteFile(outputName)

    } catch (err) {
      console.error('Audio conversion error:', err)

      setError(
        `Conversion failed: ${err.message || 'Unknown error'}`
      )

      setStatus('')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="ac-page">
      <div className="ac-wrap">

        <header className="ac-header">
          <div className="ac-logo">
            Audio<span>Convert</span>
          </div>
          <div className="ac-tag">
            Simple. Fast. Private.
          </div>
        </header>

        <section className="ac-hero">
          <h1>
            Convert audio.<br />
            <span>Without limits.</span>
          </h1>
          <p>
            Convert MP3, WAV and OGG audio files online.
            <br />
            Free, simple and directly in your browser.
          </p>
        </section>

        <section className="ac-panel">
          <div
            className={`ac-drop ${dragging ? 'over' : ''}`}
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault()
              setDragging(true)
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault()
              setDragging(false)
              selectFile(e.dataTransfer.files[0])
            }}
          >
            <div className="ac-upload-icon">🎵</div>
            <h2>Drop your audio file here</h2>
            <p>or click to browse your files</p>

            <input
              ref={fileInputRef}
              type="file"
              accept="audio/*,.mp3,.wav,.ogg,.m4a,.aac,.flac,.wma,.opus"
              hidden
              onChange={(e) => selectFile(e.target.files[0])}
            />
          </div>

          {file && (
            <div className="ac-file">
              <div>
                <strong>{file.name}</strong>
                <br />
                <small>
                  {(file.size / (1024 * 1024)).toFixed(2)} MB
                </small>
              </div>

              <button
                onClick={() => {
                  setFile(null)
                  setStatus('')
                  setError('')
                  setProgress(0)
                  setResultUrl('')
                }}
                style={{
                  background: 'none',
                  border: 0,
                  color: '#c6cce0',
                  cursor: 'pointer'
                }}
              >
                Remove ✕
              </button>
            </div>
          )}

          <div className="ac-settings">
            <div className="ac-field">
              <label htmlFor="format">Convert to</label>
              <select
                id="format"
                value={format}
                onChange={(e) => {
                  setFormat(e.target.value)
                  setStatus('')
                  setError('')
                  setResultUrl('')
                }}
              >
                <option value="mp3">MP3</option>
                <option value="wav">WAV</option>
                <option value="ogg">OGG</option>
              </select>
            </div>

            <div className="ac-field">
              <label htmlFor="quality">MP3 quality</label>
              <select
                id="quality"
                value={quality}
                onChange={(e) => setQuality(e.target.value)}
              >
                <option value="128">128 kbps</option>
                <option value="192">192 kbps</option>
                <option value="256">256 kbps</option>
                <option value="320">320 kbps</option>
              </select>
            </div>
          </div>

          {alreadySameFormat && (
            <div className="ac-message">
              This file is already in {format.toUpperCase()} format.
              Choose a different format if you want to convert it.
            </div>
          )}

          {error && (
            <div className="ac-message error">
              {error}
            </div>
          )}

          {status && !error && (
            <div className="ac-message success">
              {status}
            </div>
          )}

          {busy && (
            <div className="ac-progress">
              <div style={{ width: `${progress}%` }} />
            </div>
          )}

          <button
            className="ac-button"
            onClick={convertAudio}
            disabled={!file || busy || alreadySameFormat}
          >
            {busy ? 'Converting...' : 'Convert audio'}
          </button>

          {resultUrl && (
            <a
              className="ac-download"
              href={resultUrl}
              download={resultName}
            >
              Download {resultName}
            </a>
          )}
        </section>

        <section className="ac-content">
          <div className="ac-content-heading">
            <span className="ac-content-label">AUDIOCONVERT</span>
            <h2>A simple free online audio converter</h2>
            <p>
              AudioConvert makes it easy to change audio files
              between popular formats. Convert your audio online
              without installing additional software or creating an account.
            </p>
          </div>

          <div className="ac-content-grid">
            <article className="ac-info-card">
              <div className="ac-info-icon">🎧</div>
              <h3>MP3 Converter</h3>
              <p>
                Convert audio to MP3, a widely supported format
                that offers a practical balance between sound
                quality and file size.
              </p>
            </article>

            <article className="ac-info-card">
              <div className="ac-info-icon">🎼</div>
              <h3>WAV Converter</h3>
              <p>
                Convert audio to WAV when you need an uncompressed
                audio format for editing, production or compatible
                audio applications.
              </p>
            </article>

            <article className="ac-info-card">
              <div className="ac-info-icon">🔊</div>
              <h3>OGG Converter</h3>
              <p>
                Convert audio to OGG, an open audio format supported
                by many media players and applications.
              </p>
            </article>
          </div>

          <div className="ac-how">
            <div className="ac-content-heading">
              <span className="ac-content-label">QUICK GUIDE</span>
              <h2>How to convert audio files</h2>
              <p>
                Change your audio format in three simple steps.
              </p>
            </div>

            <div className="ac-steps">
              <article className="ac-step">
                <span>01</span>
                <h3>Upload your audio</h3>
                <p>
                  Select an audio file from your device or drag
                  and drop it into the converter.
                </p>
              </article>

              <article className="ac-step">
                <span>02</span>
                <h3>Choose a format</h3>
                <p>
                  Select MP3, WAV or OGG as your desired output
                  format. Adjust MP3 quality if needed.
                </p>
              </article>

              <article className="ac-step">
                <span>03</span>
                <h3>Convert and download</h3>
                <p>
                  Start the conversion and download your converted
                  audio file when it is ready.
                </p>
              </article>
            </div>
          </div>

          <div className="ac-privacy">
            <div className="ac-info-icon">🔒</div>
            <div>
              <h2>Audio conversion in your browser</h2>
              <p>
                AudioConvert processes your selected audio files
                locally in your browser using FFmpeg WebAssembly.
                Your audio files are not uploaded to AudioConvert
                servers for conversion. Processing speed and the
                maximum practical file size depend on your device
                and available memory.
              </p>
            </div>
          </div>

          <div className="ac-faq">
            <div className="ac-content-heading">
              <span className="ac-content-label">HELP CENTER</span>
              <h2>Frequently asked questions</h2>
            </div>

            <details>
              <summary>Is AudioConvert free to use?</summary>
              <p>
                Yes. AudioConvert is free to use. You can convert
                audio files without creating an account or paying
                for a subscription.
              </p>
            </details>

            <details>
              <summary>Which audio formats can I convert?</summary>
              <p>
                You can choose MP3, WAV or OGG as the output format.
                The converter accepts common audio file types,
                although compatibility can depend on the file codec.
              </p>
            </details>

            <details>
              <summary>Are my audio files uploaded to a server?</summary>
              <p>
                No. The conversion is performed locally in your
                browser. Your selected audio file is not uploaded
                to AudioConvert servers for conversion.
              </p>
            </details>

            <details>
              <summary>Do I need to install software?</summary>
              <p>
                No. AudioConvert works in a modern web browser.
                The audio engine loads when you start your first
                conversion.
              </p>
            </details>

            <details>
              <summary>Does converting to MP3 reduce file size?</summary>
              <p>
                MP3 is a compressed audio format and can produce
                smaller files than uncompressed WAV. The resulting
                size depends on the audio duration and selected
                bitrate.
              </p>
            </details>
          </div>
        </section>

        <footer className="ac-footer">
          Your files are processed in your browser and are not uploaded to our servers.
          <br />
          Only convert audio files you own or have permission to use.
        </footer>

      </div>
    </main>
  )
}

export default App
