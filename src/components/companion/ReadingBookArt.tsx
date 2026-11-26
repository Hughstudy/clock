import type { ReadingSceneView } from '../../contracts/presentation'
import { bookTicketAnchor } from '../../logic/scene-pose'

/** A vignette on a gently raised leaf, centred in the space between the two palms. */
export function PictureBookPage({ stage }: { stage: ReadingSceneView['stage'] }) {
  const searching = stage === 'turn'
  const carried = stage === 'found'
  return <g transform="translate(152 157) rotate(-8) skewX(23) scale(.87 .67)">
    {searching ? <g data-scene-part="reading-bakery">
      <path d="M8 11 H29 V24 H8Z" fill="#a7c4ae"/>
      <path d="M10 14 H18 V20 H10Z M21 14 H27 V24 H21Z" fill="#598b80"/>
      <path d="M7 7 H29 L31 12 H5Z" fill="#f7efd6"/>
      <path d="M8 7 H11 L10 12 H6Z M16 7 H19 V12 H15Z M24 7 H27 L29 12 H25Z" fill="#779e88"/>
    </g> : <g data-scene-part="reading-dog" data-cap={carried ? 'carried' : 'worn'}>
      <path d="M7 17 Q3 18 4 13 Q6 15 8 14 Q13 12 16 13 Q18 7 22 7 Q25 7 26 11 L30 12 Q30 15 25 15 L23 20 H21 L20 23 H18 L18 19 H12 L10 23 H8 L8 19Z"
        fill="#f1ead5" stroke="#566a66" strokeWidth=".9"/>
      <path d="M18 8 Q22 8 20 14 Q19 17 17 15 Q15 13 18 8Z" fill="#a27a57"/>
      <circle cx="24.4" cy="10.6" r=".85" fill="#334d4b"/>
      <circle cx="29.2" cy="12.4" r="1.05" fill="#334d4b"/>
      <g transform={carried ? 'translate(29 15) rotate(62) scale(-1 1) translate(-7 0)' : 'translate(21 8)'}>
        <path d="M-5 0 Q-4 -6 1 -5 Q4 -4 4 0 L8 .5 Q8 2.1 5 2 L-5 1.4Z"
          fill="#d77f68" stroke="#9a5747" strokeWidth=".8"/>
      </g>
    </g>}
  </g>
}

/** The exposed end of the ticket sits against the near edge even while the cover turns. */
export function ReadingTicket({ position }: { position: number }) {
  const anchor = bookTicketAnchor(position)
  return <g data-scene-part="reading-ticket" data-bookmark={position >= 1 ? 'next' : 'original'}
    transform={`translate(${anchor.x} ${anchor.y}) rotate(10)`}>
    <path d="M-5.5 0 H5.5 L7.2 6 Q5.9 6.5 7.7 7.8 L8.3 10.5 H-3.1 L-3.8 8 Q-2.2 7.3 -4.2 6Z"
      fill="#e9bc70" stroke="#997143" strokeWidth=".9"/>
    <path d="M-3 3.4 H4.1 M-2.1 7.4 H5.4" fill="none" stroke="#a57b47" strokeWidth=".9" strokeDasharray="1.8 1.2"/>
  </g>
}
