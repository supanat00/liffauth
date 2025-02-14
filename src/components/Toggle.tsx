import React, { useState } from 'react'
import Icon from './Icon'

const Toggle = ({ emitValue }: { emitValue: (value: boolean) => void }) => {
  const [isChecked, setIsChecked] = useState(false)

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
        <div className='shadow-card flex h-[46px] w-[82px] items-center justify-center rounded-md bg-white'>
          <span
            className={`flex h-9 w-9 items-center justify-center rounded ${
              !isChecked ? 'bg-blue-500 text-white' : 'text-body-color'
            }`}
          >
            <Icon type='camera' />
          </span>
          <span
            className={`flex h-9 w-9 items-center justify-center rounded ${
              isChecked ? 'bg-blue-500 text-white' : 'text-body-color'
            }`}
          >
            <Icon type='video' />
          </span>
        </div>
      </label>
    </>
  )
}

export default Toggle;
