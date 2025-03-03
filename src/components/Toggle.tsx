import React, { useEffect, useState } from 'react'
import Icon from './Icon'

interface ToggleProps {
  type: string | null;
  emitValue: (value: boolean) => void;
}

const Toggle: React.FC<ToggleProps> = ({ type, emitValue }) => {
  const [isChecked, setIsChecked] = useState(false);

  useEffect(() => {
    if(type === 'video') {
      setIsChecked(true);
    } else {
      setIsChecked(false);
    }
  });

  const handleCheckboxChange = () => {
    setIsChecked(!isChecked)
  }

  return (
    <>
      <label className='themeSwitcherThree relative inline-flex cursor-pointer select-none items-center'>
        <input
          type='checkbox'
          checked={isChecked}
          onChange={handleCheckboxChange}
          className='sr-only'
          onClick={() => emitValue(isChecked)}
        />
        {!isChecked && <Icon type='cameraImg' />}
        {isChecked && <Icon type='videoImg' />}
      </label>
    </>
  )
}

export default Toggle;
