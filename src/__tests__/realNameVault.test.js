import { buildVaultFromRegistry, resolveRealName } from '../privacy/realNameVault';

describe('realNameVault — pure helpers', () => {
  test('buildVaultFromRegistry maps paraAppNumber → realName', () => {
    const reg = [
      { paraAppNumber: '847293', realName: 'Maria Garcia', pseudonym: 'Red 1' },
      { paraAppNumber: '128456', realName: 'James Wilson', pseudonym: 'Blue 1' },
    ];
    expect(buildVaultFromRegistry(reg)).toEqual({
      '847293': 'Maria Garcia',
      '128456': 'James Wilson',
    });
  });

  test('buildVaultFromRegistry accepts legacy externalKey field', () => {
    const reg = [{ externalKey: '999999', realName: 'Old Format' }];
    expect(buildVaultFromRegistry(reg)).toEqual({ '999999': 'Old Format' });
  });

  test('buildVaultFromRegistry skips entries missing key or name', () => {
    const reg = [
      { paraAppNumber: '111111', realName: 'Has Both' },
      { paraAppNumber: '222222' },           // missing name
      { realName: 'No Key' },                // missing key
      { paraAppNumber: '   ', realName: 'Blank Key' },  // whitespace key
    ];
    expect(buildVaultFromRegistry(reg)).toEqual({ '111111': 'Has Both' });
  });

  test('resolveRealName returns name or null', () => {
    const vault = { '847293': 'Maria Garcia' };
    expect(resolveRealName(vault, '847293')).toBe('Maria Garcia');
    expect(resolveRealName(vault, '000000')).toBeNull();
    expect(resolveRealName(vault, null)).toBeNull();
    expect(resolveRealName(null, '847293')).toBeNull();
  });

  test('resolveRealName trims input key', () => {
    const vault = { '847293': 'Maria Garcia' };
    expect(resolveRealName(vault, '  847293  ')).toBe('Maria Garcia');
  });
});
