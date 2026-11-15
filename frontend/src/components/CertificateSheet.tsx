import React, { useRef, useState, useEffect } from 'react';

export interface CertificateSheetProps {
  name: string;
  cubeNumber: string;
  mentorName: string;
  type: 'success' | 'participation' | string;
  certificateNo: string;
  issueDate?: string | Date;
  stats?: {
    questsCount?: number;
    badgesCount?: number;
    missionContributionsCount?: number;
    attendanceRate?: string | number | null;
  };
  badges?: Array<{ id?: string; name: string }>;
}

export const CertificateSheet: React.FC<CertificateSheetProps> = ({
  name,
  cubeNumber,
  mentorName,
  type,
  certificateNo,
  issueDate = new Date(),
  stats,
  badges = [],
}) => {
  const isAchievement = type === 'success' || type === 'achievement';

  const formattedDate =
    typeof issueDate === 'string'
      ? issueDate
      : new Date(issueDate).toLocaleDateString('en-GB', {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        });

  const verificationUrl = `${window.location.origin}/verify/${certificateNo}`;
  const qrCodeImgSrc = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(
    verificationUrl
  )}`;

  const questsCount = stats?.questsCount ?? 0;
  const badgesCount = stats?.badgesCount ?? badges.length;
  const missionContributionsCount = stats?.missionContributionsCount ?? 0;
  const attendanceRateVal =
    stats?.attendanceRate !== null && stats?.attendanceRate !== undefined
      ? typeof stats.attendanceRate === 'number'
        ? `${stats.attendanceRate}%`
        : String(stats.attendanceRate)
      : '100%';

  const statsList = [
    { value: questsCount, label: 'QUESTS COMPLETED' },
    { value: badgesCount, label: 'BADGES EARNED' },
    { value: missionContributionsCount, label: 'MISSION CONTRIBUTIONS' },
    { value: attendanceRateVal, label: 'MEETING ATTENDANCE' },
  ];

  return (
    <div
      className={`w-[840px] h-[594px] p-[28px] box-border relative overflow-hidden select-text ${
        isAchievement ? 'bg-[#0E0D0B] text-[#F6F1E7]' : 'bg-[#FBF8F3] text-[#14161A]'
      }`}
      style={{
        WebkitPrintColorAdjust: 'exact',
        printColorAdjust: 'exact',
      }}
    >
      <div
        className="relative h-full w-full flex flex-col justify-between rounded p-[24px_36px_22px] overflow-hidden box-border"
        style={{
          border: isAchievement ? '1px solid rgba(201,150,43,0.42)' : '1px solid rgba(229,0,125,0.3)',
          background: isAchievement
            ? 'radial-gradient(120% 90% at 50% 0%, #1A1712 0%, #0E0D0B 62%)'
            : 'linear-gradient(180deg, #FFFFFF 0%, #FBF8F3 60%)',
        }}
      >
        {/* Watermark */}
        <img
          src={isAchievement ? '/images/iceberg-x-mark-light.png' : '/images/iceberg-x-mark.png'}
          alt=""
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none"
          style={{
            width: '360px',
            height: '360px',
            opacity: isAchievement ? 0.045 : 0.035,
          }}
        />

        {/* Top Row: Lockup & Programme Type */}
        <div className="relative flex items-center justify-between gap-6">
          <img
            src={isAchievement ? '/images/iceberg-x-lockup-light.png' : '/images/iceberg-x-lockup.png'}
            alt="Iceberg X"
            className="h-[26px] w-auto block"
          />
          <div
            className="text-right text-[8.5px] font-bold tracking-[0.2em]"
            style={{ color: isAchievement ? '#C9962B' : '#E5007D' }}
          >
            {isAchievement ? 'ELITE TECHNOLOGY FELLOWSHIP' : 'INTERNSHIP · TECHNOLOGY FELLOWSHIP'}
          </div>
        </div>

        {/* Middle Block: Titles & Recipient */}
        <div className="relative flex flex-col items-center justify-center text-center my-auto py-1">
          <div
            className="inline-flex items-center h-5 px-3 rounded-full text-[8.5px] font-extrabold tracking-[0.18em]"
            style={{
              border: isAchievement ? '1px solid rgba(201,150,43,0.55)' : '1px solid rgba(229,0,125,0.4)',
              color: isAchievement ? '#C9962B' : '#E5007D',
              background: isAchievement ? 'transparent' : 'rgba(229,0,125,0.05)',
            }}
          >
            {isAchievement ? 'CERTIFICATE OF ACHIEVEMENT' : 'CERTIFICATE OF PARTICIPATION'}
          </div>

          <h1
            className="font-serif font-normal text-[48px] leading-none tracking-[-0.015em] mt-3 mb-0"
            style={{ color: isAchievement ? '#FFFCF6' : '#14161A' }}
          >
            {isAchievement ? 'Certificate of Achievement' : 'Certificate of Participation'}
          </h1>

          <div
            className="text-[8px] font-bold tracking-[0.22em] mt-2.5"
            style={{ color: isAchievement ? '#8C8578' : '#8A93A0' }}
          >
            {isAchievement ? 'PROUDLY PRESENTED TO' : 'PRESENTED TO'}
          </div>

          <div
            className="text-[32px] font-extrabold tracking-tight leading-tight mt-1.5 pb-1.5 px-3 border-b max-w-[90%] truncate"
            style={{
              color: isAchievement ? '#FFFFFF' : '#0E1116',
              borderColor: isAchievement ? 'rgba(201,150,43,0.6)' : 'rgba(229,0,125,0.45)',
            }}
          >
            {name || 'Fellowship Candidate'}
          </div>

          <div
            className="text-[9px] font-bold tracking-[0.14em] mt-1.5 font-sans"
            style={{ color: isAchievement ? '#8C8578' : '#8A93A0' }}
          >
            CUBE #{cubeNumber} &nbsp;·&nbsp; PROGRAMME MENTOR:{' '}
            <span style={{ color: isAchievement ? '#E0B14E' : '#E5007D' }}>
              {(mentorName || 'Ahmet Onur Solmaz').toUpperCase()}
            </span>
          </div>

          <p
            className="text-[11px] leading-relaxed max-w-[560px] mt-2 mb-0 font-sans"
            style={{ color: isAchievement ? '#CFC7B8' : '#5B6472' }}
          >
            {isAchievement ? (
              <>
                In recognition of outstanding completion of the Iceberg Digital technology fellowship programme — earning every quest and badge recorded overleaf, and a permanent place as{' '}
                <strong className="text-white font-bold">Cube #{cubeNumber}</strong>.
              </>
            ) : (
              <>
                For taking part in the Iceberg Digital technology internship programme, contributing to R&amp;D missions and completing the quests and badges recorded overleaf.
              </>
            )}
          </p>
        </div>

        {/* 4 Stats Grid */}
        <div
          className="relative grid grid-cols-4 rounded-md overflow-hidden"
          style={{
            border: isAchievement ? '1px solid rgba(255,255,255,0.09)' : '1px solid #EAE4DA',
            background: isAchievement ? 'rgba(255,255,255,0.025)' : '#FFFFFF',
          }}
        >
          {statsList.map((s, idx) => (
            <div
              key={idx}
              className="py-1.5 px-2 text-center"
              style={{
                borderRight:
                  idx < 3
                    ? isAchievement
                      ? '1px solid rgba(255,255,255,0.07)'
                      : '1px solid #EFEAE1'
                    : 'none',
              }}
            >
              <div
                className="font-mono text-[16px] font-semibold leading-tight"
                style={{ color: isAchievement ? '#E0B14E' : '#E5007D' }}
              >
                {s.value}
              </div>
              <div
                className="text-[7.5px] font-bold tracking-[0.16em] mt-0.5"
                style={{ color: isAchievement ? '#98917F' : '#8A93A0' }}
              >
                {s.label}
              </div>
            </div>
          ))}
        </div>

        {/* Badges Pill Row */}
        <div className="relative flex items-center gap-2 pt-2.5">
          <span
            className="text-[7.5px] font-bold tracking-[0.16em] whitespace-nowrap"
            style={{ color: isAchievement ? '#8C8578' : '#8A93A0' }}
          >
            BADGES EARNED
          </span>
          <div className="flex-1 flex flex-wrap gap-1 overflow-hidden max-h-[22px]">
            {badges.slice(0, 8).map((b, idx) => (
              <span
                key={b.id || idx}
                className="inline-flex items-center h-4.5 px-2 rounded-full text-[8.5px] font-bold"
                style={{
                  border: isAchievement ? '1px solid rgba(201,150,43,0.32)' : '1px solid #E6DFD4',
                  color: isAchievement ? '#EBE2D2' : '#3D4652',
                  background: isAchievement ? 'rgba(201,150,43,0.08)' : '#FFFFFF',
                }}
              >
                {b.name}
              </span>
            ))}
          </div>
        </div>

        {/* Bottom Row: Signatures & Verification Details */}
        <div
          className="relative flex items-end justify-between gap-5 pt-2.5 mt-2 border-t"
          style={{
            borderColor: isAchievement ? 'rgba(255,255,255,0.08)' : '#EAE4DA',
          }}
        >
          <div className="flex gap-6">
            {[
              { name: 'Mark Burgess', role: 'CEO' },
              { name: 'Yusuf Tokgöz', role: 'CTO' },
              { name: 'Ahmet Onur Solmaz', role: 'HEAD OF ENGINEERING' },
            ].map((sig, idx) => (
              <div key={idx} className="min-w-[95px]">
                <div
                  className="h-[1px] mb-1"
                  style={{ background: isAchievement ? 'rgba(255,255,255,0.22)' : '#D6CFC2' }}
                />
                <div
                  className="text-[9.5px] font-bold leading-tight"
                  style={{ color: isAchievement ? '#F6F1E7' : '#14161A' }}
                >
                  {sig.name}
                </div>
                <div
                  className="text-[7px] font-bold tracking-[0.13em] mt-0.5"
                  style={{ color: isAchievement ? '#8C8578' : '#8A93A0' }}
                >
                  {sig.role}
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-end gap-3">
            <div
              className="text-right font-mono text-[8px] leading-relaxed"
              style={{ color: isAchievement ? '#98917F' : '#8A93A0' }}
            >
              <div>
                Certificate No:{' '}
                <span style={{ color: isAchievement ? '#EBE2D2' : '#3D4652' }}>
                  {certificateNo}
                </span>
              </div>
              <div>
                Date of Issue:{' '}
                <span style={{ color: isAchievement ? '#EBE2D2' : '#3D4652' }}>
                  {formattedDate}
                </span>
              </div>
              <div>
                Mentor:{' '}
                <span style={{ color: isAchievement ? '#EBE2D2' : '#3D4652' }}>
                  {mentorName}
                </span>
              </div>
            </div>

            <div
              className="w-[46px] h-[46px] rounded p-0.5 flex flex-col items-center justify-center gap-0.5"
              style={{
                border: isAchievement ? '1px solid rgba(201,150,43,0.4)' : '1px solid rgba(229,0,125,0.35)',
                background: isAchievement ? 'rgba(255,255,255,0.03)' : 'rgba(229,0,125,0.04)',
              }}
            >
              <img src={qrCodeImgSrc} alt="QR" className="w-[30px] h-[30px] object-contain" />
              <span
                className="text-[5.5px] font-extrabold tracking-widest leading-none"
                style={{ color: isAchievement ? '#C9962B' : '#E5007D' }}
              >
                VERIFY
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * Responsive wrapper that auto-scales the CertificateSheet to fit its container width
 * preserving the exact 840x594 A4 Landscape layout and typography.
 */
export const ScaledCertificatePreview: React.FC<CertificateSheetProps> = (props) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.45);

  useEffect(() => {
    if (!containerRef.current) return;
    const updateScale = () => {
      if (containerRef.current) {
        const width = containerRef.current.clientWidth;
        if (width > 0) {
          setScale(width / 840);
        }
      }
    };
    updateScale();
    const observer = new ResizeObserver(updateScale);
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={containerRef}
      // The certificate is a printed document: same colours in both themes.
      className="theme-fixed w-full relative overflow-hidden rounded-xl shadow-md flex items-center justify-center"
      style={{ height: Math.round(594 * scale) }}
    >
      <div
        style={{
          width: 840,
          height: 594,
          transform: `scale(${scale})`,
          transformOrigin: 'top left',
        }}
        className="absolute top-0 left-0 pointer-events-none select-none"
      >
        <CertificateSheet {...props} />
      </div>
    </div>
  );
};
