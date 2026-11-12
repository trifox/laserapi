import sys
import yt_dlp


def download_highest_quality(url):
  ydl_opts = {
      'format': 'bestvideo+bestaudio/best',
      'merge_output_format': 'mp4',
      # Bricht ab, wenn FFmpeg fehlt, anstatt unvollständig zu speichern:
      'postprocessor_args': {'ffmpeg': ['-nostats']},
      'keepvideo': True,  # <-- Hält die originalen Video- und Audiospuren im Ordner!
  }
  try:
    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
      ydl.download([url])
    print('\nDownload und Zusammenführung erfolgreich abgeschlossen!')
  except Exception as e:
    print(f'\nFehler aufgetreten: {e}')
    print(
        'Hinweis: Stellen Sie sicher, dass FFmpeg installiert und im System-PATH'
        ' eingetragen ist.'
    )


if __name__ == '__main__':
  # Wenn Parameter -k übergeben wurden, ignorieren wir sie hier einfach
  video_url = input('YouTube-URL eingeben: ')
  if video_url.strip():
    download_highest_quality(video_url.strip())
  else:
    print('Keine URL eingegeben.')