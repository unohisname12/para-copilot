import React from 'react';

// Wrap any rendered student name. When the app shell has data-privacy="on",
// CSS in styles.css blurs .privacy-blur until the user hovers/focuses it.
// Card color + position are unaffected, so the para can still identify
// students at a glance — only the readable name text is obscured.
//
// Use as: <PrivacyName>{resolveLabel(student, 'compact')}</PrivacyName>
//
// Inline by default so it drops into existing layouts without changing
// flow. Pass `as="div"` if a block-level wrapper is required.
export default function PrivacyName({ children, as: Tag = 'span', className = '', style, ...rest }) {
  const cls = ['privacy-blur', className].filter(Boolean).join(' ');
  return (
    <Tag className={cls} tabIndex={0} style={style} {...rest}>
      {children}
    </Tag>
  );
}
